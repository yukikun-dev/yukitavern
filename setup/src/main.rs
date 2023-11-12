use anyhow::Result;
use egui;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::prelude::*;
use std::net::IpAddr;
use std::path::PathBuf;

#[derive(Deserialize, Serialize, Clone)]
struct BasicAuthUser {
    username: String,
    password: String,
}

#[derive(Deserialize, Serialize, Clone)]
struct Config {
    port: u16,
    whitelist: Vec<String>,
    #[serde(rename = "whitelistMode")]
    whitelist_mode: bool,
    #[serde(rename = "basicAuthMode")]
    basic_auth_mode: bool,
    #[serde(rename = "basicAuthUser")]
    basic_auth_user: BasicAuthUser,
    #[serde(rename = "disableThumbnails")]
    disable_thumbnails: bool,
    autorun: bool,
    #[serde(rename = "enableExtensions")]
    enable_extensions: bool,
    listen: bool,
    #[serde(rename = "allowKeysExposure")]
    allow_keys_exposure: bool,
    #[serde(rename = "securityOverride")]
    security_override: bool,
    #[serde(rename = "disableCsrf")]
    disable_csrf: bool,
    ssl: bool,
    #[serde(rename = "certPath")]
    cert_path: PathBuf,
    #[serde(rename = "keyPath")]
    key_path: PathBuf,
}

enum ConfigSource {
    Default,
    File,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            port: 56565,
            whitelist: vec!["127.0.0.1".to_string()],
            whitelist_mode: true,
            basic_auth_mode: false,
            basic_auth_user: BasicAuthUser {
                username: "user".to_string(),
                password: "password".to_string(),
            },
            disable_thumbnails: false,
            autorun: true,
            enable_extensions: false,
            listen: false,
            allow_keys_exposure: false,
            security_override: false,
            disable_csrf: true,
            ssl: false,
            cert_path: PathBuf::from("certs/cert.pem"),
            key_path: PathBuf::from("certs/privkey.pem"),
        }
    }
}

fn load_config() -> (Config, ConfigSource) {
    if let Ok(contents) = fs::read_to_string("config.json") {
        if let Ok(config) = serde_json::from_str(&contents) {
            return (config, ConfigSource::File);
        }
    }
    (Config::default(), ConfigSource::Default)
}

fn save_config(config: &Config) -> Result<()> {
    let serialized = serde_json::to_string_pretty(config)?;
    let mut file = File::create("config.json")?;
    file.write_all(serialized.as_bytes())?;
    println!("Saved config");
    Ok(())
}

struct MyApp {
    config: Config,
    temp_cert_path: String,
    temp_key_path: String,
    show_toast: bool,
    toast_message: String,
    toast_timer: f32,
    toast_color: egui::Color32,
    ip_input: String,
}

impl MyApp {
    fn show_toast(&mut self, message: String, duration: f32, color: egui::Color32) {
        self.toast_message = message;
        self.show_toast = true;
        self.toast_timer = duration;
        self.toast_color = color;
    }
}

impl eframe::App for MyApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                egui::ScrollArea::horizontal().show(ui, |ui| {
                    // ui.heading("YukiTavern Configuration");
                    ui.horizontal(|ui| {
                        if ui
                            .button("Save")
                            .on_hover_text("Save the current configuration to config.json.")
                            .clicked()
                        {
                            self.config.cert_path = PathBuf::from(&self.temp_cert_path);
                            self.config.key_path = PathBuf::from(&self.temp_key_path);
                            match save_config(&self.config) {
                                Ok(_) => {
                                    self.show_toast(
                                        "Saved config".to_string(),
                                        2.0,
                                        egui::Color32::GREEN,
                                    );
                                }
                                Err(e) => {
                                    self.show_toast(
                                        format!("Failed to save config: {}", e),
                                        2.0,
                                        egui::Color32::RED,
                                    );
                                }
                            }
                        }

                        ui.add_space(20.);

                        if ui
                            .button("Reset")
                            .on_hover_text("Reset the configuration to the values in config.json.")
                            .clicked()
                        {
                            let (config, source) = load_config();
                            self.config = config;
                            self.temp_cert_path =
                                self.config.cert_path.to_string_lossy().into_owned();
                            self.temp_key_path =
                                self.config.key_path.to_string_lossy().into_owned();
                            self.ip_input = self.config.whitelist.join(",");
                            match source {
                                ConfigSource::Default => {
                                    self.show_toast(
                                        "No config file found, using default values".to_string(),
                                        2.0,
                                        egui::Color32::YELLOW,
                                    );
                                }
                                ConfigSource::File => {
                                    self.show_toast(
                                        "Reset config from file".to_string(),
                                        2.0,
                                        egui::Color32::GREEN,
                                    );
                                }
                            }
                        }

                        ui.add_space(20.);

                        if ui
                            .button("Defaults")
                            .on_hover_text(
                                "Reset the configuration to the default values.\n(won't affect config.json unless you save)",
                            )
                            .clicked()
                        {
                            self.config = Config::default();
                            self.temp_cert_path =
                                self.config.cert_path.to_string_lossy().into_owned();
                            self.temp_key_path =
                                self.config.key_path.to_string_lossy().into_owned();
                            self.ip_input = self.config.whitelist.join(",");
                            self.show_toast(
                                "Loaded default config".to_string(),
                                2.0,
                                egui::Color32::GREEN,
                            );
                        }
                    });

                    ui.add_space(20.);

                    ui.horizontal(|ui| {
                        ui.label("Port: ")
                            .on_hover_text("Port number for YukiTavern to listen on.");
                        ui.add(
                            egui::Slider::new(&mut self.config.port, 8000..=65535)
                                .drag_value_speed(1.),
                        );
                    });

                    ui.horizontal(|ui| {
                        ui.label("Whitelist Mode: ")
                            .on_hover_text("Only allow access to IP addresses in the whitelist.");
                        ui.checkbox(&mut self.config.whitelist_mode, "");
                    });
                    if self.config.whitelist_mode {
                        ui.label("Whitelisted IPs:");
                        ui.text_edit_multiline(&mut self.ip_input);

                        let re = Regex::new(r"(\d{1,3}(\.\d{1,3}){3})").unwrap();

                        self.config.whitelist = re
                            .find_iter(&self.ip_input)
                            .filter_map(|m| m.as_str().parse::<IpAddr>().ok())
                            .map(|ip| ip.to_string())
                            .collect();

                        ui.label(format!("Found IPs: {:?}", self.config.whitelist));
                    }

                    ui.horizontal(|ui| {
                        ui.label("Basic Auth Mode: ")
                            .on_hover_text("Require login to access the site.");
                        ui.checkbox(&mut self.config.basic_auth_mode, "");
                    });
                    if self.config.basic_auth_mode {
                        ui.horizontal(|ui| {
                            ui.label("Username: ");
                            ui.text_edit_singleline(&mut self.config.basic_auth_user.username);
                        });
                        ui.horizontal(|ui| {
                            ui.label("Password: ");
                            ui.text_edit_singleline(&mut self.config.basic_auth_user.password);
                        });
                    }

                    if !self.config.whitelist_mode && !self.config.basic_auth_mode {
                        ui.colored_label(
                            egui::Color32::RED,
                            "Warning: YT will be exposed to all devices on the network\nunless either whitelist or basic auth mode are enabled.",
                        );
                        self.config.security_override = true;
                    }

                    ui.horizontal(|ui| {
                        ui.label("Autorun: ")
                            .on_hover_text("Automatically open the site in the default browser.");
                        ui.checkbox(&mut self.config.autorun, "");
                    });
                    ui.horizontal(|ui| {
                        ui.label("Enable Extensions: ")
                            .on_hover_text("Enable extensions.");
                        ui.checkbox(&mut self.config.enable_extensions, "");
                    });
                    ui.horizontal(|ui| {
                        ui.label("Listen: ")
                            .on_hover_text("Listen on all interfaces.");
                        ui.checkbox(&mut self.config.listen, "");
                    });
                    ui.horizontal(|ui| {
                        ui.label("Allow Keys Exposure: ")
                            .on_hover_text("Allow the keys to be exposed via the API.");
                        ui.checkbox(&mut self.config.allow_keys_exposure, "");
                    });
                    ui.horizontal(|ui| {
                        ui.label("Disable CSRF: ")
                            .on_hover_text("Disable CSRF protection.");
                        ui.checkbox(&mut self.config.disable_csrf, "");
                    });
                    ui.horizontal(|ui| {
                        ui.label("Disable Thumbnails: ")
                            .on_hover_text("Use full size images instead of thumbnails.");
                        ui.checkbox(&mut self.config.disable_thumbnails, "");
                    });
                    ui.horizontal(|ui| {
                        ui.label("SSL: ")
                            .on_hover_text("Use HTTPS instead of HTTP.");
                        ui.checkbox(&mut self.config.ssl, "");
                    });

                    if self.config.ssl {
                        ui.horizontal(|ui| {
                            ui.label("Certificate Path: ")
                                .on_hover_text("Path to SSL certificate.");
                            ui.text_edit_singleline(&mut self.temp_cert_path);
                            if ui.button("Browse...").clicked() {
                                if let Some(path) = rfd::FileDialog::new().pick_file() {
                                    self.temp_cert_path = path.display().to_string();
                                }
                            }
                        });

                        ui.horizontal(|ui| {
                            ui.label("Key Path: ")
                                .on_hover_text("Path to SSL private key.");
                            ui.text_edit_singleline(&mut self.temp_key_path);
                            if ui.button("Browse...").clicked() {
                                if let Some(path) = rfd::FileDialog::new().pick_file() {
                                    self.temp_key_path = path.display().to_string();
                                }
                            }
                        });
                    }

                    if self.show_toast {
                        let screen_rect = ctx.input(|i| i.screen_rect);
                        egui::Area::new("toast")
                            .interactable(false)
                            .fixed_pos(egui::pos2(5., screen_rect.max.y - 30.0))
                            .show(ctx, |ui| {
                                ui.colored_label(self.toast_color, &self.toast_message);
                            });

                        let delta_time = ctx.input(|i| i.unstable_dt);
                        self.toast_timer -= delta_time;
                        if self.toast_timer <= 0.0 {
                            self.show_toast = false;
                        }
                    }
                });
            });
        });
    }
}

fn main() -> Result<(), eframe::Error> {
    let initial_toast;
    let initial_toast_color;

    let (config, source) = load_config();
    match source {
        ConfigSource::Default => {
            println!("Loaded default config");
            initial_toast = "No config file found, using default values".to_string();
            initial_toast_color = egui::Color32::YELLOW;
        }
        ConfigSource::File => {
            println!("Loaded config from file");
            initial_toast = "Loaded config from file".to_string();
            initial_toast_color = egui::Color32::GREEN;
        }
    }

    let temp_cert_path = config.cert_path.to_string_lossy().into_owned();
    let temp_key_path = config.key_path.to_string_lossy().into_owned();
    let temp_ip_input = config.whitelist.join(",");

    let mut options = eframe::NativeOptions::default();
    options.initial_window_size = Some(egui::vec2(500.0, 500.0));
    eframe::run_native(
        "YukiTavern Config Editor",
        options,
        Box::new(move |_cc| {
            Box::new(MyApp {
                config,
                temp_cert_path,
                temp_key_path,
                show_toast: false,
                toast_message: initial_toast,
                toast_timer: 2.,
                toast_color: initial_toast_color,
                ip_input: temp_ip_input,
            })
        }),
    )?;
    Ok(())
}
