package com.bioage.app;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class SplashActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "BioAgePrefs";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String KEY_MODE = "app_mode"; // "offline" or "server"

    @SuppressLint("SetTextI18n")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String savedMode = prefs.getString(KEY_MODE, "");

        // If user previously chose a mode, skip splash after a brief delay
        if (!savedMode.isEmpty()) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                launchMain(savedMode.equals("server") ? prefs.getString(KEY_SERVER_URL, "") : null);
            }, 1500);
            return;
        }

        // Show mode selection after splash animation
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            View splashLogo = findViewById(R.id.splashLogo);
            View modeSelector = findViewById(R.id.modeSelector);
            if (splashLogo != null) splashLogo.setVisibility(View.GONE);
            if (modeSelector != null) modeSelector.setVisibility(View.VISIBLE);

            Button btnOffline = findViewById(R.id.btnOffline);
            Button btnServer = findViewById(R.id.btnServer);

            btnOffline.setOnClickListener(v -> {
                prefs.edit().putString(KEY_MODE, "offline").apply();
                launchMain(null);
            });

            btnServer.setOnClickListener(v -> {
                showServerUrlDialog(prefs);
            });

        }, 2000);
    }

    private void showServerUrlDialog(SharedPreferences prefs) {
        EditText input = new EditText(this);
        input.setHint("e.g. http://192.168.1.100:3000");
        input.setText(prefs.getString(KEY_SERVER_URL, "http://localhost:3000"));
        input.setSelectAllOnFocus(true);
        input.setPadding(48, 32, 48, 32);

        new AlertDialog.Builder(this)
                .setTitle("Backend Server URL")
                .setMessage("Enter your PC's IP address and port where the BioAge server is running:")
                .setView(input)
                .setPositiveButton("Connect", (dialog, which) -> {
                    String url = input.getText().toString().trim();
                    if (!url.startsWith("http")) url = "http://" + url;
                    prefs.edit()
                            .putString(KEY_MODE, "server")
                            .putString(KEY_SERVER_URL, url)
                            .apply();
                    launchMain(url);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void launchMain(String serverUrl) {
        Intent intent = new Intent(this, MainActivity.class);
        if (serverUrl != null && !serverUrl.isEmpty()) {
            intent.putExtra("SERVER_URL", serverUrl);
        }
        startActivity(intent);
        finish();
    }
}

