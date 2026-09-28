use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use tauri::{Manager, WebviewWindow};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

fn toggle_visibility(window: &WebviewWindow) {
    let visible = window.is_visible().unwrap_or(true);
    if visible {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let visibility_shortcut = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::Space,
            );
            let click_shortcut = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::KeyL,
            );

            let click_through = Arc::new(AtomicBool::new(false));
            let click_state = click_through.clone();

            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, shortcut, event| {
                        if event.state() != ShortcutState::Pressed {
                            return;
                        }

                        let Some(window) = app.get_webview_window("main") else {
                            return;
                        };

                        if shortcut == &visibility_shortcut {
                            toggle_visibility(&window);
                            return;
                        }

                        if shortcut == &click_shortcut {
                            let next = !click_state.load(Ordering::Relaxed);
                            click_state.store(next, Ordering::Relaxed);
                            let _ = window.set_ignore_cursor_events(next);

                            if !next {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(),
            )?;

            app.global_shortcut().register(visibility_shortcut)?;
            app.global_shortcut().register(click_shortcut)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Chibi Companion");
}
