//! XOE fungible token — LOCAL SANDBOX PROTOTYPE ONLY.
//!
//! NEP-141 (fungible token) + NEP-145 (storage management) + NEP-148 (metadata).
//! Symbol `XOE`, name `Unknown Orbital Engine`.
//!
//! Minting is restricted to accounts in the owner-controlled `minters` set
//! (in the prototype: the XOE rewards contract). An optional `max_supply`
//! hard cap is enforced on every mint.
//!
//! Not deployed anywhere. Not a real asset. No real money.

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
use near_sdk::borsh::BorshSerialize;
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::store::IterableSet;
use near_sdk::{
    AccountId, BorshStorageKey, NearToken, PanicOnDefault, PromiseOrValue, assert_one_yocto, env,
    log, near, require,
};

pub const XOE_DECIMALS: u8 = 18;

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    FungibleToken,
    Metadata,
    Minters,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct XoeToken {
    token: FungibleToken,
    metadata: LazyOption<FungibleTokenMetadata>,
    owner_id: AccountId,
    minters: IterableSet<AccountId>,
    /// Hard cap on total supply (base units). `None` = uncapped (decision for Eddie).
    max_supply: Option<u128>,
}

#[near]
impl XoeToken {
    /// Initialise with the default XOE metadata.
    #[init]
    pub fn new_default_meta(owner_id: AccountId, max_supply: Option<U128>) -> Self {
        Self::new(
            owner_id,
            max_supply,
            FungibleTokenMetadata {
                spec: FT_METADATA_SPEC.to_string(),
                name: "Unknown Orbital Engine".to_string(),
                symbol: "XOE".to_string(),
                icon: None,
                reference: None,
                reference_hash: None,
                decimals: XOE_DECIMALS,
            },
        )
    }

    #[init]
    pub fn new(owner_id: AccountId, max_supply: Option<U128>, metadata: FungibleTokenMetadata) -> Self {
        metadata.assert_valid();
        let mut token = FungibleToken::new(StorageKey::FungibleToken);
        // Owner gets a (zero-balance) registration so it can receive tokens.
        token.internal_register_account(&owner_id);
        Self {
            token,
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            owner_id,
            minters: IterableSet::new(StorageKey::Minters),
            max_supply: max_supply.map(|v| v.0),
        }
    }

    // ---------- owner / minter role ----------

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Only the owner can do this");
    }

    #[payable]
    pub fn add_minter(&mut self, account_id: AccountId) {
        assert_one_yocto();
        self.assert_owner();
        self.minters.insert(account_id.clone());
        log!("Minter added: {}", account_id);
    }

    #[payable]
    pub fn remove_minter(&mut self, account_id: AccountId) {
        assert_one_yocto();
        self.assert_owner();
        self.minters.remove(&account_id);
        log!("Minter removed: {}", account_id);
    }

    #[payable]
    pub fn set_owner(&mut self, new_owner: AccountId) {
        assert_one_yocto();
        self.assert_owner();
        self.owner_id = new_owner;
    }

    pub fn is_minter(&self, account_id: AccountId) -> bool {
        self.minters.contains(&account_id)
    }

    pub fn get_minters(&self) -> Vec<AccountId> {
        self.minters.iter().cloned().collect()
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }

    pub fn get_max_supply(&self) -> Option<U128> {
        self.max_supply.map(U128)
    }

    /// Mint `amount` XOE to `account_id`. Minters only.
    /// Auto-registers the receiver (storage paid by this contract — acceptable in the
    /// prototype because only trusted minters can trigger it).
    pub fn ft_mint(&mut self, account_id: AccountId, amount: U128, memo: Option<String>) {
        require!(
            self.minters.contains(&env::predecessor_account_id()),
            "Only a minter can mint"
        );
        require!(amount.0 > 0, "Amount must be positive");
        if let Some(cap) = self.max_supply {
            let new_supply = self
                .token
                .total_supply
                .checked_add(amount.0)
                .unwrap_or_else(|| env::panic_str("Supply overflow"));
            require!(new_supply <= cap, "Mint would exceed max supply");
        }
        if !self.token.accounts.contains_key(&account_id) {
            self.token.internal_register_account(&account_id);
        }
        self.token.internal_deposit(&account_id, amount.0);
        FtMint { owner_id: &account_id, amount, memo: memo.as_deref() }.emit();
    }

    /// Burn your own tokens.
    #[payable]
    pub fn ft_burn(&mut self, amount: U128) {
        assert_one_yocto();
        let account_id = env::predecessor_account_id();
        self.token.internal_withdraw(&account_id, amount.0);
        FtBurn { owner_id: &account_id, amount, memo: None }.emit();
    }
}

#[near]
impl FungibleTokenCore for XoeToken {
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
impl FungibleTokenResolver for XoeToken {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let (used_amount, burned_amount) =
            self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned_amount > 0 {
            log!("Account @{} burned {}", sender_id, burned_amount);
        }
        used_amount.into()
    }
}

#[near]
impl StorageManagement for XoeToken {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        #[allow(unused_variables)]
        if let Some((account_id, balance)) = self.token.internal_storage_unregister(force) {
            log!("Closed @{} with {}", account_id, balance);
            true
        } else {
            false
        }
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for XoeToken {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{VMContextBuilder, accounts};
    use near_sdk::testing_env;

    fn ctx(predecessor: AccountId, deposit: u128) -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.current_account_id("xoe.test".parse().unwrap())
            .predecessor_account_id(predecessor.clone())
            .signer_account_id(predecessor)
            .attached_deposit(NearToken::from_yoctonear(deposit));
        b
    }

    fn setup(max: Option<u128>) -> XoeToken {
        testing_env!(ctx(accounts(0), 0).build());
        let mut c = XoeToken::new_default_meta(accounts(0), max.map(U128));
        testing_env!(ctx(accounts(0), 1).build());
        c.add_minter(accounts(1));
        c
    }

    #[test]
    fn metadata_is_xoe() {
        let c = setup(None);
        let m = c.ft_metadata();
        assert_eq!(m.symbol, "XOE");
        assert_eq!(m.name, "Unknown Orbital Engine");
        assert_eq!(m.spec, FT_METADATA_SPEC);
        assert_eq!(m.decimals, XOE_DECIMALS);
        assert_eq!(c.ft_total_supply().0, 0);
    }

    #[test]
    fn minter_can_mint_and_auto_registers() {
        let mut c = setup(None);
        testing_env!(ctx(accounts(1), 0).build());
        c.ft_mint(accounts(2), U128(500), None);
        assert_eq!(c.ft_balance_of(accounts(2)).0, 500);
        assert_eq!(c.ft_total_supply().0, 500);
    }

    #[test]
    #[should_panic(expected = "Only a minter can mint")]
    fn non_minter_cannot_mint() {
        let mut c = setup(None);
        testing_env!(ctx(accounts(2), 0).build());
        c.ft_mint(accounts(2), U128(1), None);
    }

    #[test]
    #[should_panic(expected = "Only the owner can do this")]
    fn non_owner_cannot_add_minter() {
        let mut c = setup(None);
        testing_env!(ctx(accounts(2), 1).build());
        c.add_minter(accounts(2));
    }

    #[test]
    fn removed_minter_loses_role() {
        let mut c = setup(None);
        testing_env!(ctx(accounts(0), 1).build());
        c.remove_minter(accounts(1));
        assert!(!c.is_minter(accounts(1)));
    }

    #[test]
    #[should_panic(expected = "Mint would exceed max supply")]
    fn max_supply_enforced() {
        let mut c = setup(Some(1_000));
        testing_env!(ctx(accounts(1), 0).build());
        c.ft_mint(accounts(2), U128(900), None);
        c.ft_mint(accounts(2), U128(101), None);
    }

    #[test]
    fn transfer_between_registered_accounts() {
        let mut c = setup(None);
        testing_env!(ctx(accounts(1), 0).build());
        c.ft_mint(accounts(2), U128(300), None);
        c.ft_mint(accounts(3), U128(1), None);
        testing_env!(ctx(accounts(2), 1).build());
        c.ft_transfer(accounts(3), U128(100), None);
        assert_eq!(c.ft_balance_of(accounts(2)).0, 200);
        assert_eq!(c.ft_balance_of(accounts(3)).0, 101);
    }
}
