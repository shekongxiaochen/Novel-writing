use std::sync::Arc;

use super::{AiProviderService, AiService, AuthService, CardKeyService, NovelService, SettingsService, WalletService};

#[derive(Clone)]
pub struct AppState {
    pub auth: Arc<AuthService>,
    pub novels: Arc<NovelService>,
    pub settings: Arc<SettingsService>,
    pub wallet: Arc<WalletService>,
    pub card_keys: Arc<CardKeyService>,
    pub providers: Arc<AiProviderService>,
    pub ai: Arc<AiService>,
}
