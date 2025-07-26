package com.remotecontrol.client.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.remotecontrol.client.ui.auth.LoginActivity
import com.remotecontrol.client.utils.PreferenceManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class SplashActivity : AppCompatActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 检查登录状态
        lifecycleScope.launch {
            delay(1000) // 显示启动画面1秒
            
            if (PreferenceManager.isLoggedIn(this@SplashActivity)) {
                startActivity(Intent(this@SplashActivity, MainActivity::class.java))
            } else {
                startActivity(Intent(this@SplashActivity, LoginActivity::class.java))
            }
            finish()
        }
    }
}