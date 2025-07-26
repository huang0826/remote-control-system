package com.remotecontrol.client.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.remotecontrol.client.RemoteControlApplication
import com.remotecontrol.client.databinding.ActivityMainBinding
import com.remotecontrol.client.service.RemoteControlService
import com.remotecontrol.client.ui.auth.LoginActivity
import com.remotecontrol.client.utils.PermissionUtils
import com.remotecontrol.client.utils.PreferenceManager
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityMainBinding
    private val app by lazy { application as RemoteControlApplication }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupViews()
        setupClickListeners()
        requestPermissions()
        startServices()
        observeUser()
    }
    
    private fun setupViews() {
        binding.textStatus.text = "远程控制服务已启动"
    }
    
    private fun setupClickListeners() {
        binding.buttonSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        
        binding.buttonLogout.setOnClickListener {
            lifecycleScope.launch {
                app.userRepository.logout()
                PreferenceManager.setLoggedIn(this@MainActivity, false)
                PreferenceManager.saveToken(this@MainActivity, "")
                
                startActivity(Intent(this@MainActivity, LoginActivity::class.java))
                finish()
            }
        }
    }
    
    private fun observeUser() {
        lifecycleScope.launch {
            app.userRepository.getCurrentUser().collect { user ->
                if (user != null) {
                    binding.textWelcome.text = "欢迎, ${user.nickname}"
                    binding.textDeviceId.text = "设备ID: ${PreferenceManager.getDeviceId(this@MainActivity)}"
                    binding.textDeviceName.text = "设备名称: ${android.os.Build.MODEL}"
                } else {
                    startActivity(Intent(this@MainActivity, LoginActivity::class.java))
                    finish()
                }
            }
        }
    }
    
    private fun requestPermissions() {
        if (!PermissionUtils.hasAllPermissions(this)) {
            PermissionUtils.requestPermissions(this)
        }
    }
    
    private fun startServices() {
        // 启动远程控制服务
        val serviceIntent = Intent(this, RemoteControlService::class.java)
        startForegroundService(serviceIntent)
        
        // 连接Socket
        app.socketService.connect(this)
        
        // 更新连接状态
        binding.textConnectionStatus.text = "连接状态: 已连接"
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        if (requestCode == PermissionUtils.REQUEST_CODE_PERMISSIONS) {
            if (!PermissionUtils.hasAllPermissions(this)) {
                binding.textStatus.text = "需要授予所有权限才能正常使用远程控制功能"
            } else {
                binding.textStatus.text = "权限已授予，远程控制功能已启用"
            }
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        app.socketService.disconnect()
    }
}