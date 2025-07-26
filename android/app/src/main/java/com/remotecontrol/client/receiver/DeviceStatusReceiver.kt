package com.remotecontrol.client.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import com.remotecontrol.client.RemoteControlApplication
import com.remotecontrol.client.service.RemoteControlService
import com.remotecontrol.client.utils.PreferenceManager

class DeviceStatusReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> {
                // 设备启动后自动启动服务
                if (PreferenceManager.isLoggedIn(context)) {
                    startRemoteControlService(context)
                }
            }
            
            ConnectivityManager.CONNECTIVITY_ACTION -> {
                // 网络状态变化时重新连接
                if (isNetworkAvailable(context) && PreferenceManager.isLoggedIn(context)) {
                    val app = context.applicationContext as RemoteControlApplication
                    app.socketService.reconnect(context)
                }
            }
        }
    }
    
    private fun startRemoteControlService(context: Context) {
        val serviceIntent = Intent(context, RemoteControlService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
    
    private fun isNetworkAvailable(context: Context): Boolean {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo
            networkInfo?.isConnected == true
        }
    }
}