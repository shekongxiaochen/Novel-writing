use axum::response::Html;
use minijinja::{Environment, Value};

pub const ADMIN_TITLE: &str = "Novel 管理后台";

/// 构建带共享外壳（shell.html + shell_nav.html）的 minijinja 环境，
/// 让各管理页能 `{% extends "shell.html" %}`，统一左侧导航 + 右侧内容布局。
pub fn shell_env() -> Environment<'static> {
    let mut env = Environment::new();
    // 保留 minijinja 对 `.html` 模板的默认 HTML 自动转义（防存储型 XSS）：
    // 任何 `{{ value }}` 默认转义，杜绝用户可控数据（如伪造的 X-Forwarded-For
    // 写入的 registration_ip、display_name 等）在 admin 后台执行脚本。
    // 需要原样注入的 JSON（const rows = {{ rows_json|safe }}）已在模板内显式用
    // `|safe` / `|tojson` 声明，不依赖全局关闭转义。
    env.add_template("shell.html", include_str!("../../admin-templates/shell.html"))
        .expect("register shell.html");
    env.add_template(
        "shell_nav.html",
        include_str!("../../admin-templates/shell_nav.html"),
    )
    .expect("register shell_nav.html");
    env
}

/// 在已注册 shell 的环境里注册并渲染页面模板。
/// `current_entity` 用于左侧导航高亮，`nav_title` 是栏目名（面包屑根，链接到 /admin/{entity}）。
pub fn render_shell_page(
    page_name: &'static str,
    page_src: &'static str,
    current_entity: &'static str,
    nav_title: &'static str,
    ctx: Value,
) -> Html<String> {
    render_shell_page_sub(page_name, page_src, current_entity, nav_title, None, ctx)
}

/// 同 `render_shell_page`，但额外提供面包屑子级标题（如「编辑」「新增」）。
/// 子页传 `Some("编辑卡密")`，顶栏显示 `卡密管理 / 编辑卡密`，前者可点击返回列表。
pub fn render_shell_page_sub(
    page_name: &'static str,
    page_src: &'static str,
    current_entity: &'static str,
    nav_title: &'static str,
    sub_title: Option<&str>,
    ctx: Value,
) -> Html<String> {
    let mut env = shell_env();
    env.add_template(page_name, page_src)
        .expect("register page template");
    let tpl = env.get_template(page_name).expect("get page template");

    let merged = minijinja::context! {
        admin_title => ADMIN_TITLE,
        current_entity => current_entity,
        nav_title => nav_title,
        sub_title => sub_title,
        ..ctx
    };
    Html(tpl.render(merged).expect("render shell page"))
}
