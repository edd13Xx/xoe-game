//! XOE game rewards — LOCAL SANDBOX PROTOTYPE ONLY.
//!
//! * Owner sets a reward table (achievement id -> XOE amount), per-player and global caps,
//!   the trusted game attester account, and can pause/unpause.
//! * Players link exactly one Solana address (base58, 32-byte pubkey) to their NEAR account.
//!   The mapping is one-to-one in both directions.
//! * Only the attester (a trusted game server in the prototype) can attest achievements.
//!   ANTI-CHEAT LIMIT: the contract can only trust what the attester says; it cannot verify
//!   gameplay. A compromised attester key can mint up to the caps.
//! * A player claims each attested achievement once; claim asks the XOE token to mint to them.
//! * BRIDGE MOCK (SIMULATION): players can `ft_transfer_call` XOE or mock wNEAR to this
//!   contract with msg `bridge_to_solana`. The tokens are held here and a *simulated* bridge
//!   intent targeting their linked Solana address is recorded. No real bridge is called.

use near_contract_standards::fungible_token::receiver::FungibleTokenReceiver;
use near_sdk::json_types::{U64, U128};
use near_sdk::store::{IterableMap, IterableSet, LookupMap, LookupSet, Vector};
use near_sdk::{
    AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue,
    assert_one_yocto, env, ext_contract, log, near, require,
};

/// Deposit required to link a Solana address (covers the storage of both mappings).
pub const LINK_DEPOSIT: NearToken = NearToken::from_millinear(10); // 0.01 NEAR
pub const GAS_FOR_MINT: Gas = Gas::from_tgas(15);
pub const GAS_FOR_CLAIM_CALLBACK: Gas = Gas::from_tgas(15);
pub const BRIDGE_MSG: &str = "bridge_to_solana";
pub const SIMULATION_LABEL: &str =
    "SIMULATION: no real bridge call was made; tokens are held by the rewards contract";
pub const MAX_ACHIEVEMENT_ID_LEN: usize = 64;

#[ext_contract(ext_xoe_token)]
pub trait XoeToken {
    fn ft_mint(&mut self, account_id: AccountId, amount: U128, memo: Option<String>);
}

#[ext_contract(ext_self)]
pub trait SelfCallbacks {
    fn on_claim_mint(&mut self, player: AccountId, achievement: String, amount: U128) -> bool;
}

#[near]
#[derive(BorshStorageKey)]
enum StorageKey {
    Rewards,
    PlayerIssued,
    NearToSol,
    SolToNear,
    Attested,
    Claimed,
    BridgeTokens,
    Intents,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum IntentStatus {
    SimulatedPending,
    SimulatedCompleted,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct BridgeIntent {
    pub id: U64,
    pub near_account: AccountId,
    pub solana_address: String,
    /// NEP-141 token that was handed over (XOE or mock wNEAR).
    pub token: AccountId,
    pub amount: U128,
    pub status: IntentStatus,
    pub created_at_ns: U64,
    pub label: String,
}

#[near(serializers = [json])]
pub struct Config {
    pub owner_id: AccountId,
    pub attester_id: AccountId,
    pub token_id: AccountId,
    pub paused: bool,
    pub per_player_cap: U128,
    pub global_cap: U128,
    pub total_issued: U128,
    pub bridge_tokens: Vec<AccountId>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct XoeRewards {
    owner_id: AccountId,
    attester_id: AccountId,
    token_id: AccountId,
    paused: bool,
    rewards: IterableMap<String, u128>,
    per_player_cap: u128,
    global_cap: u128,
    /// Includes amounts reserved for in-flight mints (rolled back on failure).
    total_issued: u128,
    player_issued: LookupMap<AccountId, u128>,
    near_to_sol: LookupMap<AccountId, String>,
    sol_to_near: LookupMap<String, AccountId>,
    attested: LookupSet<String>,
    claimed: LookupSet<String>,
    bridge_tokens: IterableSet<AccountId>,
    intents: Vector<BridgeIntent>,
}

/// Returns true when `addr` is a well-formed Solana public key:
/// base58 (Bitcoin alphabet), 32..=44 characters, decoding to exactly 32 bytes.
/// (Does not check ed25519 curve membership — program-derived addresses are off-curve anyway.)
pub fn is_valid_solana_address(addr: &str) -> bool {
    if addr.len() < 32 || addr.len() > 44 {
        return false;
    }
    match bs58::decode(addr).into_vec() {
        Ok(bytes) => bytes.len() == 32,
        Err(_) => false,
    }
}

fn key(account: &AccountId, achievement: &str) -> String {
    // ':' cannot appear in a NEAR account id, so this key is unambiguous.
    format!("{account}:{achievement}")
}

#[near]
impl XoeRewards {
    #[init]
    pub fn new(
        owner_id: AccountId,
        attester_id: AccountId,
        token_id: AccountId,
        per_player_cap: U128,
        global_cap: U128,
    ) -> Self {
        let mut bridge_tokens = IterableSet::new(StorageKey::BridgeTokens);
        bridge_tokens.insert(token_id.clone());
        Self {
            owner_id,
            attester_id,
            token_id,
            paused: false,
            rewards: IterableMap::new(StorageKey::Rewards),
            per_player_cap: per_player_cap.0,
            global_cap: global_cap.0,
            total_issued: 0,
            player_issued: LookupMap::new(StorageKey::PlayerIssued),
            near_to_sol: LookupMap::new(StorageKey::NearToSol),
            sol_to_near: LookupMap::new(StorageKey::SolToNear),
            attested: LookupSet::new(StorageKey::Attested),
            claimed: LookupSet::new(StorageKey::Claimed),
            bridge_tokens,
            intents: Vector::new(StorageKey::Intents),
        }
    }

    // ================= owner =================

    fn assert_owner(&self) {
        assert_one_yocto();
        require!(env::predecessor_account_id() == self.owner_id, "Only the owner can do this");
    }

    fn assert_not_paused(&self) {
        require!(!self.paused, "Rewards are paused");
    }

    #[payable]
    pub fn set_reward(&mut self, achievement: String, amount: U128) {
        self.assert_owner();
        require!(
            !achievement.is_empty() && achievement.len() <= MAX_ACHIEVEMENT_ID_LEN,
            "Bad achievement id"
        );
        require!(amount.0 > 0, "Reward must be positive");
        self.rewards.insert(achievement.clone(), amount.0);
        log!("Reward set: {} = {}", achievement, amount.0);
    }

    #[payable]
    pub fn remove_reward(&mut self, achievement: String) {
        self.assert_owner();
        self.rewards.remove(&achievement);
    }

    #[payable]
    pub fn set_caps(&mut self, per_player_cap: U128, global_cap: U128) {
        self.assert_owner();
        self.per_player_cap = per_player_cap.0;
        self.global_cap = global_cap.0;
    }

    #[payable]
    pub fn set_attester(&mut self, attester_id: AccountId) {
        self.assert_owner();
        self.attester_id = attester_id;
    }

    #[payable]
    pub fn set_owner(&mut self, new_owner: AccountId) {
        self.assert_owner();
        self.owner_id = new_owner;
    }

    #[payable]
    pub fn pause(&mut self) {
        self.assert_owner();
        self.paused = true;
        log!("Rewards paused");
    }

    #[payable]
    pub fn unpause(&mut self) {
        self.assert_owner();
        self.paused = false;
        log!("Rewards unpaused");
    }

    #[payable]
    pub fn add_bridge_token(&mut self, token: AccountId) {
        self.assert_owner();
        self.bridge_tokens.insert(token);
    }

    #[payable]
    pub fn remove_bridge_token(&mut self, token: AccountId) {
        self.assert_owner();
        self.bridge_tokens.remove(&token);
    }

    /// SIMULATION: owner marks a simulated bridge intent as done. Nothing moves anywhere.
    #[payable]
    pub fn sim_mark_intent_completed(&mut self, id: U64) {
        self.assert_owner();
        let intent = self
            .intents
            .get_mut(id.0 as u32)
            .unwrap_or_else(|| env::panic_str("No such intent"));
        require!(intent.status == IntentStatus::SimulatedPending, "Intent is not pending");
        intent.status = IntentStatus::SimulatedCompleted;
        log!("SIMULATION: intent {} marked completed (no real bridge)", id.0);
    }

    // ================= players =================

    /// Link the caller's NEAR account to one Solana address. Attach 0.01 NEAR (storage).
    #[payable]
    pub fn link_solana(&mut self, solana_address: String) {
        self.assert_not_paused();
        require!(env::attached_deposit() >= LINK_DEPOSIT, "Attach 0.01 NEAR to link");
        require!(is_valid_solana_address(&solana_address), "Invalid Solana address");
        let player = env::predecessor_account_id();
        require!(
            !self.near_to_sol.contains_key(&player),
            "This NEAR account already has a linked Solana address"
        );
        require!(
            !self.sol_to_near.contains_key(&solana_address),
            "This Solana address is already linked to another NEAR account"
        );
        self.near_to_sol.insert(player.clone(), solana_address.clone());
        self.sol_to_near.insert(solana_address.clone(), player.clone());
        let refund = env::attached_deposit().saturating_sub(LINK_DEPOSIT);
        if !refund.is_zero() {
            Promise::new(player.clone()).transfer(refund).detach();
        }
        log!("Linked {} -> {}", player, solana_address);
    }

    // ================= attester =================

    /// Game attester says `player` earned `achievement`.
    pub fn attest(&mut self, player: AccountId, achievement: String) {
        self.assert_not_paused();
        require!(
            env::predecessor_account_id() == self.attester_id,
            "Only the game attester can attest"
        );
        require!(self.rewards.contains_key(&achievement), "Unknown achievement");
        require!(self.near_to_sol.contains_key(&player), "Player has not linked a Solana address");
        let k = key(&player, &achievement);
        require!(!self.attested.contains(&k), "Already attested");
        self.attested.insert(k);
        log!("Attested {} for {}", achievement, player);
    }

    // ================= claim =================

    /// Claim the XOE reward for an attested achievement (once). Attach >= 50 Tgas.
    pub fn claim(&mut self, achievement: String) -> Promise {
        self.assert_not_paused();
        let player = env::predecessor_account_id();
        require!(self.near_to_sol.contains_key(&player), "Link a Solana address first");
        let k = key(&player, &achievement);
        require!(self.attested.contains(&k), "Achievement not attested for this player");
        require!(!self.claimed.contains(&k), "Already claimed");
        let amount = *self
            .rewards
            .get(&achievement)
            .unwrap_or_else(|| env::panic_str("Unknown achievement"));

        let issued = self.player_issued.get(&player).copied().unwrap_or(0);
        let new_player_total = issued.checked_add(amount).expect("overflow");
        require!(new_player_total <= self.per_player_cap, "Per-player cap reached");
        let new_global = self.total_issued.checked_add(amount).expect("overflow");
        require!(new_global <= self.global_cap, "Global cap reached");

        // Reserve first (prevents re-entrancy / double spend while the mint is in flight).
        self.claimed.insert(k);
        self.player_issued.insert(player.clone(), new_player_total);
        self.total_issued = new_global;

        ext_xoe_token::ext(self.token_id.clone())
            .with_static_gas(GAS_FOR_MINT)
            .ft_mint(player.clone(), U128(amount), Some(format!("XOE reward: {achievement}")))
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CLAIM_CALLBACK)
                    .on_claim_mint(player, achievement, U128(amount)),
            )
    }

    /// Callback: roll back the reservation if the mint failed.
    #[private]
    pub fn on_claim_mint(&mut self, player: AccountId, achievement: String, amount: U128) -> bool {
        let ok = env::promise_result_checked(0, 64).is_ok();
        if !ok {
            self.claimed.remove(&key(&player, &achievement));
            let issued = self.player_issued.get(&player).copied().unwrap_or(0);
            self.player_issued.insert(player.clone(), issued.saturating_sub(amount.0));
            self.total_issued = self.total_issued.saturating_sub(amount.0);
            log!("Mint failed; claim of {} for {} rolled back", achievement, player);
        } else {
            log!("Claimed {} XOE for {} ({})", amount.0, player, achievement);
        }
        ok
    }

    // ================= views =================

    pub fn get_config(&self) -> Config {
        Config {
            owner_id: self.owner_id.clone(),
            attester_id: self.attester_id.clone(),
            token_id: self.token_id.clone(),
            paused: self.paused,
            per_player_cap: U128(self.per_player_cap),
            global_cap: U128(self.global_cap),
            total_issued: U128(self.total_issued),
            bridge_tokens: self.bridge_tokens.iter().cloned().collect(),
        }
    }

    pub fn get_reward(&self, achievement: String) -> Option<U128> {
        self.rewards.get(&achievement).map(|v| U128(*v))
    }

    pub fn list_rewards(&self) -> Vec<(String, U128)> {
        self.rewards.iter().map(|(k, v)| (k.clone(), U128(*v))).collect()
    }

    pub fn get_solana_address(&self, account_id: AccountId) -> Option<String> {
        self.near_to_sol.get(&account_id).cloned()
    }

    pub fn get_near_account(&self, solana_address: String) -> Option<AccountId> {
        self.sol_to_near.get(&solana_address).cloned()
    }

    pub fn is_attested(&self, account_id: AccountId, achievement: String) -> bool {
        self.attested.contains(&key(&account_id, &achievement))
    }

    pub fn is_claimed(&self, account_id: AccountId, achievement: String) -> bool {
        self.claimed.contains(&key(&account_id, &achievement))
    }

    pub fn get_player_issued(&self, account_id: AccountId) -> U128 {
        U128(self.player_issued.get(&account_id).copied().unwrap_or(0))
    }

    pub fn check_solana_address(&self, solana_address: String) -> bool {
        is_valid_solana_address(&solana_address)
    }

    pub fn intents_count(&self) -> U64 {
        U64(self.intents.len() as u64)
    }

    pub fn get_intent(&self, id: U64) -> Option<BridgeIntent> {
        self.intents.get(id.0 as u32).cloned()
    }

    pub fn list_intents(&self, from_index: Option<U64>, limit: Option<U64>) -> Vec<BridgeIntent> {
        let from = from_index.map(|v| v.0).unwrap_or(0) as usize;
        let limit = limit.map(|v| v.0).unwrap_or(50).min(100) as usize;
        self.intents.iter().skip(from).take(limit).cloned().collect()
    }
}

/// BRIDGE MOCK entry point (SIMULATION). Accepts XOE / mock wNEAR sent with
/// `ft_transfer_call(receiver_id = rewards, msg = "bridge_to_solana")`.
/// Panicking here makes the token contract refund the sender in full.
#[near]
impl FungibleTokenReceiver for XoeRewards {
    fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        self.assert_not_paused();
        let token = env::predecessor_account_id();
        require!(self.bridge_tokens.contains(&token), "Token not accepted by the bridge mock");
        require!(msg == BRIDGE_MSG, "Unsupported msg; use bridge_to_solana");
        require!(amount.0 > 0, "Amount must be positive");
        let solana_address = self
            .near_to_sol
            .get(&sender_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("Sender has not linked a Solana address"));
        let id = self.intents.len() as u64;
        self.intents.push(BridgeIntent {
            id: U64(id),
            near_account: sender_id.clone(),
            solana_address: solana_address.clone(),
            token: token.clone(),
            amount,
            status: IntentStatus::SimulatedPending,
            created_at_ns: U64(env::block_timestamp()),
            label: SIMULATION_LABEL.to_string(),
        });
        log!(
            "SIMULATION bridge intent #{}: {} {} from {} -> Solana {} (no real bridge call)",
            id, amount.0, token, sender_id, solana_address
        );
        PromiseOrValue::Value(U128(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{VMContextBuilder, accounts, get_created_receipts};
    use near_sdk::{PromiseResult, RuntimeFeesConfig, test_vm_config, testing_env};

    const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);

    // accounts(0)=owner alice, (1)=attester bob, (2)=player charlie, (3)=player danny, (4)=eugene
    fn token() -> AccountId {
        "xoe-token.test".parse().unwrap()
    }
    fn wnear() -> AccountId {
        "wnear-mock.test".parse().unwrap()
    }
    /// Made-up test Solana addresses: base58 of a fixed 32-byte pattern.
    fn sol(n: u8) -> String {
        bs58::encode([n; 32]).into_string()
    }

    fn set(predecessor: AccountId, deposit: NearToken) {
        testing_env!(VMContextBuilder::new()
            .current_account_id("rewards.test".parse().unwrap())
            .predecessor_account_id(predecessor.clone())
            .signer_account_id(predecessor)
            .attached_deposit(deposit)
            .prepaid_gas(Gas::from_tgas(300))
            .build());
    }

    fn setup() -> XoeRewards {
        set(accounts(0), NearToken::from_yoctonear(0));
        let mut c = XoeRewards::new(accounts(0), accounts(1), token(), U128(250), U128(400));
        set(accounts(0), ONE_YOCTO);
        c.set_reward("colony_cleared".into(), U128(50));
        c.set_reward("boss_beaten".into(), U128(100));
        c.set_reward("game_finished".into(), U128(200));
        c
    }

    fn link(c: &mut XoeRewards, who: AccountId, addr: String) {
        set(who, LINK_DEPOSIT);
        c.link_solana(addr);
    }

    fn attest(c: &mut XoeRewards, who: AccountId, ach: &str) {
        set(accounts(1), NearToken::from_yoctonear(0));
        c.attest(who, ach.into());
    }

    fn claim(c: &mut XoeRewards, who: AccountId, ach: &str) {
        set(who, NearToken::from_yoctonear(0));
        let _ = c.claim(ach.into());
    }

    #[test]
    fn solana_address_validation() {
        assert!(is_valid_solana_address(&sol(7)));
        assert!(is_valid_solana_address("11111111111111111111111111111111")); // 32 zero bytes
        assert!(!is_valid_solana_address("")); // empty
        assert!(!is_valid_solana_address("0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl")); // non-base58 chars
        assert!(!is_valid_solana_address(&bs58::encode([9u8; 31]).into_string())); // 31 bytes
        assert!(!is_valid_solana_address(&bs58::encode([9u8; 33]).into_string())); // 33 bytes
        assert!(!is_valid_solana_address("0x52908400098527886E0F7030069857D2E4169EE7")); // EVM style
    }

    #[test]
    fn link_is_one_to_one() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        assert_eq!(c.get_solana_address(accounts(2)), Some(sol(1)));
        assert_eq!(c.get_near_account(sol(1)), Some(accounts(2)));
    }

    #[test]
    #[should_panic(expected = "already has a linked Solana address")]
    fn second_link_for_same_near_account_rejected() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        link(&mut c, accounts(2), sol(2));
    }

    #[test]
    #[should_panic(expected = "already linked to another NEAR account")]
    fn same_solana_address_for_two_accounts_rejected() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        link(&mut c, accounts(3), sol(1));
    }

    #[test]
    #[should_panic(expected = "Invalid Solana address")]
    fn invalid_solana_address_rejected() {
        let mut c = setup();
        link(&mut c, accounts(2), "not-a-solana-address".into());
    }

    #[test]
    #[should_panic(expected = "Attach 0.01 NEAR to link")]
    fn link_requires_deposit() {
        let mut c = setup();
        set(accounts(2), NearToken::from_yoctonear(0));
        c.link_solana(sol(1));
    }

    #[test]
    #[should_panic(expected = "Only the game attester can attest")]
    fn non_attester_rejected() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        set(accounts(2), NearToken::from_yoctonear(0)); // player tries to attest themselves
        c.attest(accounts(2), "boss_beaten".into());
    }

    #[test]
    #[should_panic(expected = "Unknown achievement")]
    fn attest_unknown_achievement_rejected() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        attest(&mut c, accounts(2), "made_up");
    }

    #[test]
    #[should_panic(expected = "Player has not linked a Solana address")]
    fn attest_unlinked_player_rejected() {
        let mut c = setup();
        attest(&mut c, accounts(2), "boss_beaten");
    }

    #[test]
    fn attest_and_claim_reserves_and_creates_mint_promise() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        attest(&mut c, accounts(2), "boss_beaten");
        assert!(c.is_attested(accounts(2), "boss_beaten".into()));
        claim(&mut c, accounts(2), "boss_beaten");
        assert!(c.is_claimed(accounts(2), "boss_beaten".into()));
        assert_eq!(c.get_player_issued(accounts(2)).0, 100);
        assert_eq!(c.get_config().total_issued.0, 100);
        let receipts = get_created_receipts();
        assert!(receipts.iter().any(|r| r.receiver_id == token()));
    }

    #[test]
    #[should_panic(expected = "Already claimed")]
    fn double_claim_rejected() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        attest(&mut c, accounts(2), "boss_beaten");
        claim(&mut c, accounts(2), "boss_beaten");
        claim(&mut c, accounts(2), "boss_beaten");
    }

    #[test]
    #[should_panic(expected = "Already attested")]
    fn double_attest_rejected() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        attest(&mut c, accounts(2), "boss_beaten");
        attest(&mut c, accounts(2), "boss_beaten");
    }

    #[test]
    #[should_panic(expected = "Achievement not attested for this player")]
    fn claim_without_attestation_rejected() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        claim(&mut c, accounts(2), "boss_beaten");
    }

    #[test]
    #[should_panic(expected = "Per-player cap reached")]
    fn per_player_cap_enforced() {
        let mut c = setup(); // cap 250
        link(&mut c, accounts(2), sol(1));
        for a in ["game_finished", "colony_cleared"] {
            attest(&mut c, accounts(2), a);
            claim(&mut c, accounts(2), a); // 200 + 50 = 250 ok
        }
        attest(&mut c, accounts(2), "boss_beaten");
        claim(&mut c, accounts(2), "boss_beaten"); // 350 > 250
    }

    #[test]
    #[should_panic(expected = "Global cap reached")]
    fn global_cap_enforced() {
        let mut c = setup(); // global 400
        link(&mut c, accounts(2), sol(1));
        link(&mut c, accounts(3), sol(2));
        attest(&mut c, accounts(2), "game_finished");
        claim(&mut c, accounts(2), "game_finished"); // 200
        attest(&mut c, accounts(3), "game_finished");
        claim(&mut c, accounts(3), "game_finished"); // 400
        attest(&mut c, accounts(3), "colony_cleared");
        claim(&mut c, accounts(3), "colony_cleared"); // 450 > 400
    }

    #[test]
    #[should_panic(expected = "Rewards are paused")]
    fn pause_blocks_claim() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        attest(&mut c, accounts(2), "boss_beaten");
        set(accounts(0), ONE_YOCTO);
        c.pause();
        claim(&mut c, accounts(2), "boss_beaten");
    }

    #[test]
    fn unpause_restores_claim() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        attest(&mut c, accounts(2), "boss_beaten");
        set(accounts(0), ONE_YOCTO);
        c.pause();
        assert!(c.get_config().paused);
        c.unpause();
        claim(&mut c, accounts(2), "boss_beaten");
        assert!(c.is_claimed(accounts(2), "boss_beaten".into()));
    }

    #[test]
    #[should_panic(expected = "Only the owner can do this")]
    fn non_owner_cannot_pause() {
        let mut c = setup();
        set(accounts(2), ONE_YOCTO);
        c.pause();
    }

    #[test]
    #[should_panic(expected = "Only the owner can do this")]
    fn non_owner_cannot_set_reward() {
        let mut c = setup();
        set(accounts(1), ONE_YOCTO);
        c.set_reward("free_money".into(), U128(1_000_000));
    }

    #[test]
    fn failed_mint_rolls_back_claim() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        attest(&mut c, accounts(2), "boss_beaten");
        claim(&mut c, accounts(2), "boss_beaten");
        testing_env!(
            VMContextBuilder::new()
                .current_account_id("rewards.test".parse().unwrap())
                .predecessor_account_id("rewards.test".parse().unwrap())
                .build(),
            test_vm_config(),
            RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Failed],
        );
        assert!(!c.on_claim_mint(accounts(2), "boss_beaten".into(), U128(100)));
        assert!(!c.is_claimed(accounts(2), "boss_beaten".into()));
        assert_eq!(c.get_player_issued(accounts(2)).0, 0);
        assert_eq!(c.get_config().total_issued.0, 0);
    }

    #[test]
    fn bridge_mock_records_simulated_intent() {
        let mut c = setup();
        set(accounts(0), ONE_YOCTO);
        c.add_bridge_token(wnear());
        link(&mut c, accounts(2), sol(1));
        set(wnear(), NearToken::from_yoctonear(0));
        let r = c.ft_on_transfer(accounts(2), U128(5_000), BRIDGE_MSG.into());
        assert!(matches!(r, PromiseOrValue::Value(U128(0))));
        let i = c.get_intent(U64(0)).unwrap();
        assert_eq!(i.solana_address, sol(1));
        assert_eq!(i.token, wnear());
        assert_eq!(i.status, IntentStatus::SimulatedPending);
        assert!(i.label.starts_with("SIMULATION"));
        set(accounts(0), ONE_YOCTO);
        c.sim_mark_intent_completed(U64(0));
        assert_eq!(c.get_intent(U64(0)).unwrap().status, IntentStatus::SimulatedCompleted);
    }

    #[test]
    #[should_panic(expected = "Token not accepted by the bridge mock")]
    fn bridge_mock_rejects_unknown_token() {
        let mut c = setup();
        link(&mut c, accounts(2), sol(1));
        set("evil-token.test".parse().unwrap(), NearToken::from_yoctonear(0));
        let _ = c.ft_on_transfer(accounts(2), U128(5), BRIDGE_MSG.into());
    }

    #[test]
    #[should_panic(expected = "Sender has not linked a Solana address")]
    fn bridge_mock_rejects_unlinked_sender() {
        let mut c = setup();
        set(token(), NearToken::from_yoctonear(0));
        let _ = c.ft_on_transfer(accounts(3), U128(5), BRIDGE_MSG.into());
    }
}
