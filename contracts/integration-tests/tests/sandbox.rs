//! LOCAL SANDBOX integration tests. Everything runs on a throwaway local NEAR node
//! started by `near-sandbox`. Every account below is made up and exists only inside that
//! node. Nothing touches testnet or mainnet, and no real keys or money are used.

use near_api::{AccountId, NearGas, NearToken, NetworkConfig, Signer};
use serde_json::{Value, json};
use std::sync::Arc;

const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
const LINK_DEPOSIT: NearToken = NearToken::from_millinear(10);

/// Made-up Solana-format addresses (base58 of fixed 32-byte patterns). Not real wallets.
const SOL_A: &str = "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi"; // 32 bytes of 0x01
const SOL_B: &str = "8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR"; // 32 bytes of 0x02
const SOL_C: &str = "CktRuQ2mttgRGkXJtyksdKHjUdc2C4TgDzyB98oEzy8"; // 32 bytes of 0x03

struct Env {
    _sandbox: near_sandbox::Sandbox,
    net: NetworkConfig,
    signer: Arc<Signer>,
    owner: AccountId,
    attester: AccountId,
    p1: AccountId,
    p2: AccountId,
    cheater: AccountId,
    token: AccountId,
    rewards: AccountId,
    wnear: AccountId,
}

fn build(contract_dir: &str) -> Vec<u8> {
    let manifest = format!("{}/../contracts/{}/Cargo.toml", env!("CARGO_MANIFEST_DIR"), contract_dir);
    let opts = cargo_near_build::BuildOpts::builder().manifest_path(manifest.as_str()).build();
    let path = cargo_near_build::build_with_cli(opts).expect("contract build failed");
    std::fs::read(path).unwrap()
}

async fn create(sandbox: &near_sandbox::Sandbox, name: &str) -> AccountId {
    let id: AccountId = format!("{name}.sandbox").parse().unwrap();
    sandbox
        .create_account(id.as_str().parse().unwrap())
        .initial_balance(NearToken::from_near(20))
        .send()
        .await
        .unwrap();
    id
}

impl Env {
    /// Deploys token + rewards + wNEAR mock. per-player cap 250, global cap 400 (base units).
    /// `make_minter=false` leaves the rewards contract without the minter role (to test rollback).
    async fn new(make_minter: bool) -> Env {
        let (token_wasm, rewards_wasm, wnear_wasm) =
            (build("xoe-token"), build("xoe-rewards"), build("wnear-mock"));
        let sandbox = near_sandbox::Sandbox::start_sandbox().await.unwrap();
        let net = NetworkConfig::from_rpc_url("sandbox", sandbox.rpc_addr.parse().unwrap());
        let signer = Signer::from_secret_key(
            near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY.parse().unwrap(),
        )
        .unwrap();
        let owner = create(&sandbox, "owner").await;
        let attester = create(&sandbox, "attester").await;
        let p1 = create(&sandbox, "player1").await;
        let p2 = create(&sandbox, "player2").await;
        let cheater = create(&sandbox, "cheater").await;
        let token = create(&sandbox, "xoe").await;
        let rewards = create(&sandbox, "rewards").await;
        let wnear = create(&sandbox, "wnear").await;

        let deploy = |id: AccountId, wasm: Vec<u8>, method: &'static str, args: Value| {
            let signer = signer.clone();
            let net = net.clone();
            async move {
                near_api::Contract::deploy(id)
                    .use_code(wasm)
                    .with_init_call(method, args)
                    .unwrap()
                    .with_signer(signer)
                    .send_to(&net)
                    .await
                    .unwrap()
                    .assert_success();
            }
        };
        deploy(token.clone(), token_wasm, "new_default_meta", json!({"owner_id": owner, "max_supply": "1000000"})).await;
        deploy(
            rewards.clone(),
            rewards_wasm,
            "new",
            json!({"owner_id": owner, "attester_id": attester, "token_id": token,
                   "per_player_cap": "250", "global_cap": "400"}),
        )
        .await;
        deploy(wnear.clone(), wnear_wasm, "new", json!({})).await;

        let env = Env { _sandbox: sandbox, net, signer, owner, attester, p1, p2, cheater, token, rewards, wnear };
        if make_minter {
            let (t, o, r) = (env.token.clone(), env.owner.clone(), env.rewards.clone());
            env.call(&t, &o, "add_minter", json!({"account_id": r}), ONE_YOCTO).await.assert_success();
        }
        for (ach, amt) in [("colony_cleared", "50"), ("boss_beaten", "100"), ("game_finished", "200")] {
            let (r, o) = (env.rewards.clone(), env.owner.clone());
            env.call(&r, &o, "set_reward", json!({"achievement": ach, "amount": amt}), ONE_YOCTO)
                .await
                .assert_success();
        }
        env
    }

    async fn call(
        &self,
        contract: &AccountId,
        signer_id: &AccountId,
        method: &str,
        args: Value,
        deposit: NearToken,
    ) -> near_api::types::transaction::result::TransactionResult {
        near_api::Contract(contract.clone())
            .call_function(method, args)
            .transaction()
            .deposit(deposit)
            .gas(NearGas::from_tgas(150))
            .with_signer(signer_id.clone(), self.signer.clone())
            .send_to(&self.net)
            .await
            .unwrap()
    }

    async fn view<T: serde::de::DeserializeOwned + Send + Sync + 'static>(&self, contract: &AccountId, method: &str, args: Value) -> T {
        near_api::Contract(contract.clone())
            .call_function(method, args)
            .read_only()
            .fetch_from(&self.net)
            .await
            .unwrap()
            .data
    }

    async fn xoe_balance(&self, who: &AccountId) -> u128 {
        let v: String = self.view(&self.token, "ft_balance_of", json!({"account_id": who})).await;
        v.parse().unwrap()
    }

    async fn link(&self, who: &AccountId, sol: &str) -> near_api::types::transaction::result::TransactionResult {
        self.call(&self.rewards, who, "link_solana", json!({"solana_address": sol}), LINK_DEPOSIT).await
    }
    async fn attest(&self, by: &AccountId, player: &AccountId, ach: &str) -> near_api::types::transaction::result::TransactionResult {
        self.call(&self.rewards, by, "attest", json!({"player": player, "achievement": ach}), NearToken::from_yoctonear(0)).await
    }
    async fn claim(&self, who: &AccountId, ach: &str) -> near_api::types::transaction::result::TransactionResult {
        self.call(&self.rewards, who, "claim", json!({"achievement": ach}), NearToken::from_yoctonear(0)).await
    }
}

/// Assert a transaction failed and its error mentions `needle`.
#[track_caller]
fn expect_fail(res: near_api::types::transaction::result::TransactionResult, needle: &str) {
    let failure = res.assert_failure();
    let text = format!("{:?}", failure);
    assert!(text.contains(needle), "expected failure containing {needle:?}, got {text}");
}

#[tokio::test]
async fn link_rules() -> testresult::TestResult<()> {
    let e = Env::new(true).await;
    // invalid Solana address
    expect_fail(e.link(&e.p1, "not-a-solana-address").await, "Invalid Solana address");
    expect_fail(e.link(&e.p1, "0x52908400098527886E0F7030069857D2E4169EE7").await, "Invalid Solana address");
    // valid link
    e.link(&e.p1, SOL_A).await.assert_success();
    let sol: Option<String> = e.view(&e.rewards, "get_solana_address", json!({"account_id": e.p1})).await;
    assert_eq!(sol.as_deref(), Some(SOL_A));
    let back: Option<String> = e.view(&e.rewards, "get_near_account", json!({"solana_address": SOL_A})).await;
    assert_eq!(back.as_deref(), Some(e.p1.as_str()));
    // duplicate links
    expect_fail(e.link(&e.p1, SOL_B).await, "already has a linked Solana address");
    expect_fail(e.link(&e.p2, SOL_A).await, "already linked to another NEAR account");
    // missing deposit
    expect_fail(
        e.call(&e.rewards, &e.p2, "link_solana", json!({"solana_address": SOL_B}), NearToken::from_yoctonear(0)).await,
        "Attach 0.01 NEAR",
    );
    e.link(&e.p2, SOL_B).await.assert_success();
    Ok(())
}

#[tokio::test]
async fn attest_claim_caps_pause() -> testresult::TestResult<()> {
    let e = Env::new(true).await;
    e.link(&e.p1, SOL_A).await.assert_success();
    e.link(&e.p2, SOL_B).await.assert_success();

    // non-attester (player attesting themselves, or a random account) is rejected
    expect_fail(e.attest(&e.p1, &e.p1, "boss_beaten").await, "Only the game attester can attest");
    expect_fail(e.attest(&e.cheater, &e.p1, "boss_beaten").await, "Only the game attester can attest");
    // unlinked player can't be attested; unknown achievement rejected
    expect_fail(e.attest(&e.attester, &e.cheater, "boss_beaten").await, "Player has not linked");
    expect_fail(e.attest(&e.attester, &e.p1, "free_money").await, "Unknown achievement");
    // claim before attest rejected
    expect_fail(e.claim(&e.p1, "boss_beaten").await, "not attested");

    // attest + claim mints XOE
    e.attest(&e.attester, &e.p1, "boss_beaten").await.assert_success();
    e.claim(&e.p1, "boss_beaten").await.assert_success();
    assert_eq!(e.xoe_balance(&e.p1).await, 100);
    // double claim / double attest rejected
    expect_fail(e.claim(&e.p1, "boss_beaten").await, "Already claimed");
    expect_fail(e.attest(&e.attester, &e.p1, "boss_beaten").await, "Already attested");
    assert_eq!(e.xoe_balance(&e.p1).await, 100);

    // per-player cap 250: 100 + 50 = 150 ok, + 200 = 350 rejected
    e.attest(&e.attester, &e.p1, "colony_cleared").await.assert_success();
    e.claim(&e.p1, "colony_cleared").await.assert_success();
    e.attest(&e.attester, &e.p1, "game_finished").await.assert_success();
    expect_fail(e.claim(&e.p1, "game_finished").await, "Per-player cap reached");
    assert_eq!(e.xoe_balance(&e.p1).await, 150);

    // pause blocks attest + claim; non-owner can't pause
    expect_fail(e.call(&e.rewards, &e.p1, "pause", json!({}), ONE_YOCTO).await, "Only the owner");
    e.call(&e.rewards, &e.owner, "pause", json!({}), ONE_YOCTO).await.assert_success();
    expect_fail(e.attest(&e.attester, &e.p2, "game_finished").await, "Rewards are paused");
    expect_fail(e.claim(&e.p1, "game_finished").await, "Rewards are paused");
    e.call(&e.rewards, &e.owner, "unpause", json!({}), ONE_YOCTO).await.assert_success();

    // global cap 400: issued 150; p2 game_finished 200 -> 350; p2 colony 50 -> 400 (exactly at cap);
    // a third player's colony 50 -> 450 rejected by the global cap (their own cap is fine)
    e.attest(&e.attester, &e.p2, "game_finished").await.assert_success();
    e.claim(&e.p2, "game_finished").await.assert_success();
    e.attest(&e.attester, &e.p2, "colony_cleared").await.assert_success();
    e.claim(&e.p2, "colony_cleared").await.assert_success();
    assert_eq!(e.xoe_balance(&e.p2).await, 250);
    e.link(&e.cheater, SOL_C).await.assert_success();
    e.attest(&e.attester, &e.cheater, "colony_cleared").await.assert_success();
    expect_fail(e.claim(&e.cheater, "colony_cleared").await, "Global cap reached");
    assert_eq!(e.xoe_balance(&e.cheater).await, 0);

    let cfg: Value = e.view(&e.rewards, "get_config", json!({})).await;
    assert_eq!(cfg["total_issued"], "400");
    let supply: String = e.view(&e.token, "ft_total_supply", json!({})).await;
    assert_eq!(supply, "400");
    // only the minter (rewards contract) can mint directly
    expect_fail(
        e.call(&e.token, &e.cheater, "ft_mint", json!({"account_id": e.cheater, "amount": "999"}), NearToken::from_yoctonear(0)).await,
        "Only a minter can mint",
    );
    Ok(())
}

#[tokio::test]
async fn failed_mint_rolls_back_claim() -> testresult::TestResult<()> {
    let e = Env::new(false).await; // rewards contract is NOT a minter
    e.link(&e.p1, SOL_A).await.assert_success();
    e.attest(&e.attester, &e.p1, "boss_beaten").await.assert_success();
    let ok: bool = e.claim(&e.p1, "boss_beaten").await.assert_success().json()?;
    assert!(!ok, "callback should report failure");
    let claimed: bool = e.view(&e.rewards, "is_claimed", json!({"account_id": e.p1, "achievement": "boss_beaten"})).await;
    assert!(!claimed, "claim must be rolled back so the player can retry");
    assert_eq!(e.xoe_balance(&e.p1).await, 0);
    // owner fixes the minter role -> retry succeeds
    e.call(&e.token, &e.owner, "add_minter", json!({"account_id": e.rewards}), ONE_YOCTO).await.assert_success();
    let ok: bool = e.claim(&e.p1, "boss_beaten").await.assert_success().json()?;
    assert!(ok);
    assert_eq!(e.xoe_balance(&e.p1).await, 100);
    Ok(())
}

#[tokio::test]
async fn wnear_mock_bridge_flow() -> testresult::TestResult<()> {
    let e = Env::new(true).await;
    let label: String = e.view(&e.wnear, "simulation_label", json!({})).await;
    assert!(label.starts_with("SIMULATION"));
    e.link(&e.p1, SOL_A).await.assert_success();
    e.link(&e.p2, SOL_C).await.assert_success();

    // player wraps 1 NEAR into mock wNEAR
    e.call(&e.wnear, &e.p1, "near_deposit", json!({}), NearToken::from_near(1)).await.assert_success();
    let wbal: String = e.view(&e.wnear, "ft_balance_of", json!({"account_id": e.p1})).await;
    let wbal: u128 = wbal.parse()?;
    assert!(wbal > 0);

    // rewards contract must be registered on wNEAR mock to receive it; owner allow-lists the token
    e.call(&e.wnear, &e.owner, "storage_deposit", json!({"account_id": e.rewards}), NearToken::from_millinear(10)).await.assert_success();
    e.call(&e.token, &e.owner, "storage_deposit", json!({"account_id": e.rewards}), NearToken::from_millinear(10)).await.assert_success();

    // not yet allow-listed -> ft_on_transfer panics -> tokens refunded, no intent
    e.call(&e.wnear, &e.p1, "ft_transfer_call",
        json!({"receiver_id": e.rewards, "amount": "1000", "msg": "bridge_to_solana"}), ONE_YOCTO).await.assert_success();
    let n: String = e.view(&e.rewards, "intents_count", json!({})).await;
    assert_eq!(n, "0");
    let after: String = e.view(&e.wnear, "ft_balance_of", json!({"account_id": e.p1})).await;
    assert_eq!(after.parse::<u128>()?, wbal, "refund expected");

    e.call(&e.rewards, &e.owner, "add_bridge_token", json!({"token": e.wnear}), ONE_YOCTO).await.assert_success();
    // wrong msg -> refunded
    e.call(&e.wnear, &e.p1, "ft_transfer_call",
        json!({"receiver_id": e.rewards, "amount": "1000", "msg": "send_to_mars"}), ONE_YOCTO).await.assert_success();
    // valid -> simulated intent recorded to the linked Solana address
    e.call(&e.wnear, &e.p1, "ft_transfer_call",
        json!({"receiver_id": e.rewards, "amount": "1000", "msg": "bridge_to_solana"}), ONE_YOCTO).await.assert_success();
    let intent: Value = e.view(&e.rewards, "get_intent", json!({"id": "0"})).await;
    assert_eq!(intent["solana_address"], SOL_A);
    assert_eq!(intent["near_account"], e.p1.as_str());
    assert_eq!(intent["token"], e.wnear.as_str());
    assert_eq!(intent["amount"], "1000");
    assert_eq!(intent["status"], "SimulatedPending");
    assert!(intent["label"].as_str().unwrap().starts_with("SIMULATION"));
    let held: String = e.view(&e.wnear, "ft_balance_of", json!({"account_id": e.rewards})).await;
    assert_eq!(held, "1000");

    // earned XOE can be routed the same way (XOE token is allow-listed at init)
    e.attest(&e.attester, &e.p2, "colony_cleared").await.assert_success();
    e.claim(&e.p2, "colony_cleared").await.assert_success();
    e.call(&e.token, &e.p2, "ft_transfer_call",
        json!({"receiver_id": e.rewards, "amount": "20", "msg": "bridge_to_solana"}), ONE_YOCTO).await.assert_success();
    let intent: Value = e.view(&e.rewards, "get_intent", json!({"id": "1"})).await;
    assert_eq!(intent["solana_address"], SOL_C);
    assert_eq!(intent["token"], e.token.as_str());
    assert_eq!(e.xoe_balance(&e.p2).await, 30);

    // unlinked sender -> refunded, no intent
    e.call(&e.wnear, &e.cheater, "near_deposit", json!({}), NearToken::from_near(1)).await.assert_success();
    e.call(&e.wnear, &e.cheater, "ft_transfer_call",
        json!({"receiver_id": e.rewards, "amount": "5", "msg": "bridge_to_solana"}), ONE_YOCTO).await.assert_success();
    let n: String = e.view(&e.rewards, "intents_count", json!({})).await;
    assert_eq!(n, "2");

    // owner marks the simulated intent done (still nothing leaves the sandbox)
    expect_fail(e.call(&e.rewards, &e.p1, "sim_mark_intent_completed", json!({"id": "0"}), ONE_YOCTO).await, "Only the owner");
    e.call(&e.rewards, &e.owner, "sim_mark_intent_completed", json!({"id": "0"}), ONE_YOCTO).await.assert_success();
    let intent: Value = e.view(&e.rewards, "get_intent", json!({"id": "0"})).await;
    assert_eq!(intent["status"], "SimulatedCompleted");

    // unwrap remaining mock wNEAR
    e.call(&e.wnear, &e.p1, "near_withdraw", json!({"amount": (wbal - 1000).to_string()}), ONE_YOCTO).await.assert_success();
    let left: String = e.view(&e.wnear, "ft_balance_of", json!({"account_id": e.p1})).await;
    assert_eq!(left, "0");
    Ok(())
}
