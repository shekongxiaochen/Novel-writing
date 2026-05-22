use std::sync::Arc;

use super::{AuthService, NovelService};

#[derive(Clone)]
pub struct AppState {
    pub auth: Arc<AuthService>,
    pub novels: Arc<NovelService>,
}
