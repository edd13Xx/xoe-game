//! wNEAR MOCK — *** SIMULATION ONLY ***
//!
//! A tiny stand-in for the real wrapped-NEAR contract (`wrap.near` / `wrap.testnet`).
//! It is a plain NEP-141 token where `near_deposit` mints 1:1 wNEAR for attached NEAR
//! and `near_withdraw` burns wNEAR and returns NEAR. Used only inside the local
//! sandbox tests. It talks to no bridge and holds no real funds.

use near_contract_standards::fungible_token::events::{FtBurn, FtMint};
use near_contract_standards::fungible_token::metadata::{
    FT_METADATA_SPEC, FungibleTokenMetadata, FungibleTokenMetadataProvider,
};
use near_contract_standards::fungible_token::{
    FungibleToken, FungibleTokenCore, FungibleTokenResolver,
};
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::json_types::U128;
use near_sdk::{
    AccountId, NearToken, PanicOnDefault, Promise, PromiseOrValue, assert_one_yocto, env, log,
    near, require,
};

pub const SIMULATION_LABEL: &str = "SIMULATION: mock wNEAR, local sandbox only, not real wrap.near";

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct WNearMock {
    token: FungibleToken,
}

#[near]
impl WNearMock {
    #[init]
    pub fn new() -> Self {
        Self { token: FungibleToken::new(b"t".to_vec()) }
    }

    pub fn simulation_label(&self) -> String {
        SIMULATION_LABEL.to_string()
    }

    /// Wrap attached NEAR into mock wNEAR (1:1). Registers the caller if needed;
    /// the storage cost is taken out of the attached deposit.
    #[payable]
    pub fn near_deposit(&mut self) {
        let account_id = env::predecessor_account_id();
        let mut amount = env::attached_deposit().as_yoctonear();
        if !self.token.accounts.contains_key(&account_id) {
            let min = self.token.storage_balance_bounds().min.as_yoctonear();
            require!(amount > min, "Attach more than the storage minimum to register");
            amount -= min;
            self.token.internal_register_account(&account_id);
        }
        require!(amount > 0, "Nothing to wrap");
        self.token.internal_deposit(&account_id, amount);
        FtMint { owner_id: &account_id, amount: U128(amount), memo: Some("mock wrap") }.emit();
    }

    /// Unwrap mock wNEAR back to NEAR (1:1).
    #[payable]
    pub fn near_withdraw(&mut self, amount: U128) -> Promise {
        assert_one_yocto();
        let account_id = env::predecessor_account_id();
        self.token.internal_withdraw(&account_id, amount.0);
        FtBurn { owner_id: &account_id, amount, memo: Some("mock unwrap") }.emit();
        Promise::new(account_id).transfer(NearToken::from_yoctonear(amount.0 + 1))
    }
}

#[near]
impl FungibleTokenCore for WNearMock {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }
    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }
    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }
    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for WNearMock {
    #[private]
    fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        let (used, burned) = self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned > 0 {
            log!("Account @{} burned {}", sender_id, burned);
        }
        used.into()
    }
}

#[near]
impl StorageManagement for WNearMock {
    #[payable]
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }
    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }
    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.internal_storage_unregister(force).is_some()
    }
    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }
    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for WNearMock {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "Wrapped NEAR (MOCK - SIMULATION)".to_string(),
            symbol: "wNEAR-MOCK".to_string(),
            icon: None,
            reference: None,
            reference_hash: None,
            decimals: 24,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{VMContextBuilder, accounts};
    use near_sdk::testing_env;

    fn ctx(p: AccountId, deposit: NearToken) {
        testing_env!(VMContextBuilder::new()
            .current_account_id("wnear.test".parse().unwrap())
            .predecessor_account_id(p)
            .attached_deposit(deposit)
            .build());
    }

    #[test]
    fn wrap_registers_and_mints_net_of_storage() {
        ctx(accounts(0), NearToken::from_near(0));
        let mut c = WNearMock::new();
        let min = c.storage_balance_bounds().min;
        ctx(accounts(1), NearToken::from_near(1));
        c.near_deposit();
        assert_eq!(
            c.ft_balance_of(accounts(1)).0,
            NearToken::from_near(1).as_yoctonear() - min.as_yoctonear()
        );
        assert!(c.ft_metadata().name.contains("SIMULATION"));
    }

    #[test]
    fn unwrap_burns() {
        ctx(accounts(0), NearToken::from_near(0));
        let mut c = WNearMock::new();
        ctx(accounts(1), NearToken::from_near(1));
        c.near_deposit();
        let bal = c.ft_balance_of(accounts(1)).0;
        ctx(accounts(1), NearToken::from_yoctonear(1));
        let _ = c.near_withdraw(U128(bal));
        assert_eq!(c.ft_balance_of(accounts(1)).0, 0);
        assert_eq!(c.ft_total_supply().0, 0);
    }
}
