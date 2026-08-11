// Dev-only HTTP+SSE mirror of the Tauri IPC commands (docs/IPC_SPEC.md "Dev Server" table),
// so the frontend can run against a real filesystem/watcher via `npm run dev` without Tauri.
// `cargo run -p backend --features dev-server` - binds 127.0.0.1:7878, only reachable from the
// Vite dev server's origin (docs/PLAN.md M5: "CORS는 localhost:5173만 허용, 바인딩은 127.0.0.1").

use axum::extract::{Query, Request};
use axum::http::{header, HeaderValue, StatusCode};
use axum::middleware::{self, Next};
use axum::response::sse::{Event as SseEvent, KeepAlive, Sse};
use axum::response::{IntoResponse, Json, Response};
use axum::routing::{get, post};
use axum::Router;
use futures_core::Stream;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::sync::mpsc;

const ADDR: &str = "127.0.0.1:7878";
const ALLOWED_ORIGIN: &str = "http://localhost:5173";

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/file", get(get_file))
        .route("/api/config", get(get_config))
        .route("/api/config/reload", post(post_config_reload))
        .route("/api/config/reset", post(post_config_reset))
        .route("/api/events", get(get_events))
        .layer(middleware::from_fn(allow_frontend_origin));

    let listener = tokio::net::TcpListener::bind(ADDR)
        .await
        .unwrap_or_else(|err| panic!("failed to bind {ADDR}: {err}"));
    println!("LightMark dev server listening on http://{ADDR}");
    axum::serve(listener, app).await.unwrap();
}

async fn allow_frontend_origin(req: Request, next: Next) -> Response {
    let mut res = next.run(req).await;
    res.headers_mut().insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static(ALLOWED_ORIGIN),
    );
    res
}

async fn health() -> &'static str {
    "ok"
}

#[derive(Deserialize)]
struct PathQuery {
    path: String,
}

async fn get_file(Query(q): Query<PathQuery>) -> Response {
    match backend::read_file(Path::new(&q.path)) {
        Ok(content) => content.into_response(),
        Err(err) => (StatusCode::NOT_FOUND, err.to_string()).into_response(),
    }
}

async fn get_config() -> Json<backend::Config> {
    Json(backend::load_config())
}

async fn post_config_reload() -> Json<backend::Config> {
    // No in-memory cache to invalidate - load_config() always reads from disk fresh, so "reload"
    // and a plain read are the same operation here.
    Json(backend::load_config())
}

async fn post_config_reset() -> Response {
    match backend::reset_config() {
        Ok(config) => Json(config).into_response(),
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()).into_response(),
    }
}

async fn get_events(Query(q): Query<PathQuery>) -> Response {
    let path = PathBuf::from(&q.path);
    let (tx, rx) = mpsc::channel::<SseEvent>(8);

    match backend::watch_file(&path, move || {
        // Runs on watcher.rs's plain OS thread, not inside the tokio runtime - blocking_send is
        // exactly the API tokio provides for that.
        let _ = tx.blocking_send(SseEvent::default().data("changed"));
    }) {
        Ok(watcher) => Sse::new(WatchStream {
            rx,
            _watcher: watcher,
        })
        .keep_alive(KeepAlive::default())
        .into_response(),
        Err(err) => (StatusCode::BAD_REQUEST, err.to_string()).into_response(),
    }
}

/// Bridges the watcher's plain callback into an SSE stream, and - the whole point of owning
/// `_watcher` here rather than off in some detached task - stops watching the moment this
/// stream is dropped. Axum drops the stream as soon as the client disconnects, which is exactly
/// docs/IPC_SPEC.md's "연결 종료 = unwatch".
struct WatchStream {
    rx: mpsc::Receiver<SseEvent>,
    _watcher: backend::FileWatcher,
}

impl Stream for WatchStream {
    type Item = Result<SseEvent, std::convert::Infallible>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.get_mut();
        this.rx.poll_recv(cx).map(|opt| opt.map(Ok))
    }
}
