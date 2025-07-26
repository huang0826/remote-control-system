package com.remotecontrol.client.webrtc

import android.content.Context
import android.util.Log
import org.json.JSONObject
import org.webrtc.*
import org.webrtc.audio.JavaAudioDeviceModule
import org.webrtc.Camera2Enumerator
import org.webrtc.PeerConnectionFactory
import org.webrtc.MediaConstraints
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoCapturer
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.MediaStream
import org.webrtc.IceCandidate
import org.webrtc.SessionDescription
import com.remotecontrol.client.service.SocketService

class WebRTCManager(private val context: Context, private val socketService: SocketService) {
    private val TAG = "WebRTCManager"
    
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var localVideoSource: VideoSource? = null
    private var localAudioSource: AudioSource? = null
    private var localVideoTrack: VideoTrack? = null
    private var localAudioTrack: AudioTrack? = null
    private var videoCapturer: VideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var localMediaStream: MediaStream? = null
    private var currentCameraType = "back"
    
    private val iceServers = listOf(
        PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
        PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
    )
    
    init {
        initializePeerConnectionFactory()
    }
    
    private fun initializePeerConnectionFactory() {
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(true)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)
        
        val peerConnectionFactoryOptions = PeerConnectionFactory.Options()
        
        val audioDeviceModule = JavaAudioDeviceModule.builder(context)
            .createAudioDeviceModule()
        
        peerConnectionFactory = PeerConnectionFactory.builder()
            .setOptions(peerConnectionFactoryOptions)
            .setAudioDeviceModule(audioDeviceModule)
            .createPeerConnectionFactory()
    }
    
    fun startLiveVideo(taskId: String) {
        createPeerConnection()
        createVideoTrack()
        createOffer(taskId)
    }
    
    fun stopLiveVideo() {
        localVideoTrack?.setEnabled(false)
        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        videoCapturer = null
        
        peerConnection?.close()
        peerConnection = null
        
        localVideoSource?.dispose()
        localVideoSource = null
        
        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null
    }
    
    fun startLiveAudio(taskId: String) {
        createPeerConnection()
        createAudioTrack()
        createOffer(taskId)
    }
    
    fun stopLiveAudio() {
        localAudioTrack?.setEnabled(false)
        
        peerConnection?.close()
        peerConnection = null
        
        localAudioSource?.dispose()
        localAudioSource = null
    }
    
    fun switchCamera(cameraType: String) {
        if (currentCameraType == cameraType) return
        
        currentCameraType = cameraType
        videoCapturer?.let {
            if (it is CameraVideoCapturer) {
                it.switchCamera(null)
            }
        }
    }
    
    private fun createPeerConnection() {
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers)
        rtcConfig.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        
        peerConnection = peerConnectionFactory?.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onSignalingChange(signalingState: PeerConnection.SignalingState) {
                Log.d(TAG, "onSignalingChange: $signalingState")
            }
            
            override fun onIceConnectionChange(iceConnectionState: PeerConnection.IceConnectionState) {
                Log.d(TAG, "onIceConnectionChange: $iceConnectionState")
            }
            
            override fun onIceConnectionReceivingChange(receiving: Boolean) {
                Log.d(TAG, "onIceConnectionReceivingChange: $receiving")
            }
            
            override fun onIceGatheringChange(iceGatheringState: PeerConnection.IceGatheringState) {
                Log.d(TAG, "onIceGatheringChange: $iceGatheringState")
            }
            
            override fun onIceCandidate(iceCandidate: IceCandidate) {
                Log.d(TAG, "onIceCandidate: $iceCandidate")
                val json = JSONObject().apply {
                    put("type", "ice_candidate")
                    put("sdpMLineIndex", iceCandidate.sdpMLineIndex)
                    put("sdpMid", iceCandidate.sdpMid)
                    put("candidate", iceCandidate.sdp)
                }
                socketService.emit("webrtc_message", json)
            }
            
            override fun onIceCandidatesRemoved(iceCandidates: Array<IceCandidate>) {
                Log.d(TAG, "onIceCandidatesRemoved")
            }
            
            override fun onAddStream(mediaStream: MediaStream) {
                Log.d(TAG, "onAddStream")
            }
            
            override fun onRemoveStream(mediaStream: MediaStream) {
                Log.d(TAG, "onRemoveStream")
            }
            
            override fun onDataChannel(dataChannel: DataChannel) {
                Log.d(TAG, "onDataChannel")
            }
            
            override fun onRenegotiationNeeded() {
                Log.d(TAG, "onRenegotiationNeeded")
            }
            
            override fun onAddTrack(rtpReceiver: RtpReceiver, mediaStreams: Array<MediaStream>) {
                Log.d(TAG, "onAddTrack")
            }
        })
        
        localMediaStream = peerConnectionFactory?.createLocalMediaStream("ARDAMS")
    }
    
    private fun createVideoTrack() {
        val cameraEnumerator = Camera2Enumerator(context)
        val deviceNames = cameraEnumerator.deviceNames
        
        // 选择前置或后置摄像头
        var cameraName: String? = null
        if (currentCameraType == "front") {
            for (deviceName in deviceNames) {
                if (cameraEnumerator.isFrontFacing(deviceName)) {
                    cameraName = deviceName
                    break
                }
            }
        } else {
            for (deviceName in deviceNames) {
                if (cameraEnumerator.isBackFacing(deviceName)) {
                    cameraName = deviceName
                    break
                }
            }
        }
        
        if (cameraName == null) {
            cameraName = deviceNames[0] // 默认使用第一个摄像头
        }
        
        videoCapturer = cameraEnumerator.createCapturer(cameraName, null)
        surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", null)
        localVideoSource = peerConnectionFactory?.createVideoSource(videoCapturer?.isScreencast ?: false)
        videoCapturer?.initialize(surfaceTextureHelper, context, localVideoSource?.capturerObserver)
        videoCapturer?.startCapture(640, 480, 30)
        
        localVideoTrack = peerConnectionFactory?.createVideoTrack("ARDAMSv0", localVideoSource)
        localVideoTrack?.setEnabled(true)
        
        localMediaStream?.addTrack(localVideoTrack)
        peerConnection?.addTrack(localVideoTrack, listOf(localMediaStream?.id))
    }
    
    private fun createAudioTrack() {
        val audioConstraints = MediaConstraints()
        localAudioSource = peerConnectionFactory?.createAudioSource(audioConstraints)
        localAudioTrack = peerConnectionFactory?.createAudioTrack("ARDAMSa0", localAudioSource)
        localAudioTrack?.setEnabled(true)
        
        localMediaStream?.addTrack(localAudioTrack)
        peerConnection?.addTrack(localAudioTrack, listOf(localMediaStream?.id))
    }
    
    private fun createOffer(taskId: String) {
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }
        
        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sessionDescription: SessionDescription) {
                peerConnection?.setLocalDescription(object : SdpObserver {
                    override fun onCreateSuccess(p0: SessionDescription) {}
                    override fun onSetSuccess() {
                        val json = JSONObject().apply {
                            put("type", "offer")
                            put("sdp", sessionDescription.description)
                            put("task_id", taskId)
                        }
                        socketService.emit("webrtc_offer", json)
                    }
                    override fun onCreateFailure(p0: String) {}
                    override fun onSetFailure(p0: String) {}
                }, sessionDescription)
            }
            
            override fun onSetSuccess() {}
            override fun onCreateFailure(error: String) {
                Log.e(TAG, "Create offer error: $error")
            }
            override fun onSetFailure(error: String) {}
        }, constraints)
    }
    
    fun handleAnswer(sdp: String) {
        val sessionDescription = SessionDescription(SessionDescription.Type.ANSWER, sdp)
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onCreateSuccess(p0: SessionDescription) {}
            override fun onSetSuccess() {
                Log.d(TAG, "Remote description set successfully")
            }
            override fun onCreateFailure(p0: String) {}
            override fun onSetFailure(error: String) {
                Log.e(TAG, "Set remote description error: $error")
            }
        }, sessionDescription)
    }
    
    fun handleIceCandidate(sdpMid: String, sdpMLineIndex: Int, sdp: String) {
        val iceCandidate = IceCandidate(sdpMid, sdpMLineIndex, sdp)
        peerConnection?.addIceCandidate(iceCandidate)
    }
}