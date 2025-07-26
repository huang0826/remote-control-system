package com.remotecontrol.client

import android.app.Application
import com.remotecontrol.client.data.local.AppDatabase
import com.remotecontrol.client.data.repository.UserRepository
import com.remotecontrol.client.data.repository.DeviceRepository
import com.remotecontrol.client.network.ApiClient
import com.remotecontrol.client.service.SocketService
import com.remotecontrol.client.utils.PreferenceManager

class RemoteControlApplication : Application() {
    
    // 数据库实例
    val database by lazy { AppDatabase.getDatabase(this) }
    
    // 仓库实例
    val userRepository by lazy { UserRepository(ApiClient.userApi, database.userDao()) }
    val deviceRepository by lazy { DeviceRepository(ApiClient.deviceApi, database.deviceDao()) }
    
    // Socket服务
    val socketService by lazy { SocketService() }
    
    override fun onCreate() {
        super.onCreate()
        instance = this
        
        // 初始化API客户端
        initializeApiClient()
        
        // 设置默认服务器地址
        if (PreferenceManager.getServerUrl(this) == "http://localhost:3000") {
            PreferenceManager.saveServerUrl(this, "http://114.215.211.109:3000")
            // 重新初始化API客户端
            initializeApiClient()
        }
    }
    
    fun initializeApiClient() {
        ApiClient.initialize(this)
    }
    
    companion object {
        lateinit var instance: RemoteControlApplication
            private set
    }
}