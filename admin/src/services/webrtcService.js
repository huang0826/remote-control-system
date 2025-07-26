import socketService from './socketService';

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.deviceId = null;
    this.onStreamCallback = null;
    
    // STUN服务器配置
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };
  }

  async initConnection(deviceId, onStreamCallback) {
    try {
      this.deviceId = deviceId;
      this.onStreamCallback = onStreamCallback;
      
      // 创建RTCPeerConnection
      this.peerConnection = new RTCPeerConnection(this.configuration);
      
      // 设置事件监听器
      this.setupPeerConnectionListeners();
      
      // 设置Socket事件监听器
      this.setupSocketListeners();
      
      // 加入设备房间
      socketService.joinDeviceRoom(deviceId);
      
      console.log('WebRTC连接初始化成功');
      return true;
    } catch (error) {
      console.error('WebRTC连接初始化失败:', error);
      throw error;
    }
  }

  setupPeerConnectionListeners() {
    // ICE候选事件
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendIceCandidate(this.deviceId, event.candidate);
      }
    };

    // 远程流事件
    this.peerConnection.ontrack = (event) => {
      console.log('收到远程流');
      this.remoteStream = event.streams[0];
      if (this.onStreamCallback) {
        this.onStreamCallback(this.remoteStream);
      }
    };

    // 连接状态变化
    this.peerConnection.onconnectionstatechange = () => {
      console.log('连接状态:', this.peerConnection.connectionState);
    };

    // ICE连接状态变化
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE连接状态:', this.peerConnection.iceConnectionState);
    };
  }

  setupSocketListeners() {
    // 处理Offer
    socketService.addListener('offer', async (data) => {
      if (data.deviceId === this.deviceId) {
        await this.handleOffer(data.offer);
      }
    });

    // 处理Answer
    socketService.addListener('answer', async (data) => {
      if (data.deviceId === this.deviceId) {
        await this.handleAnswer(data.answer);
      }
    });

    // 处理ICE候选
    socketService.addListener('ice-candidate', async (data) => {
      if (data.deviceId === this.deviceId) {
        await this.handleIceCandidate(data.candidate);
      }
    });
  }

  async handleOffer(offer) {
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      socketService.sendAnswer(this.deviceId, answer);
      console.log('处理Offer并发送Answer成功');
    } catch (error) {
      console.error('处理Offer失败:', error);
    }
  }

  async handleAnswer(answer) {
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('处理Answer成功');
    } catch (error) {
      console.error('处理Answer失败:', error);
    }
  }

  async handleIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('添加ICE候选成功');
    } catch (error) {
      console.error('添加ICE候选失败:', error);
    }
  }

  async createOffer() {
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      socketService.sendOffer(this.deviceId, offer);
      
      console.log('创建并发送Offer成功');
      return offer;
    } catch (error) {
      console.error('创建Offer失败:', error);
      throw error;
    }
  }

  closeConnection() {
    try {
      // 关闭本地流
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // 关闭远程流
      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach(track => track.stop());
        this.remoteStream = null;
      }

      // 关闭PeerConnection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // 离开设备房间
      if (this.deviceId) {
        socketService.leaveDeviceRoom(this.deviceId);
        this.deviceId = null;
      }

      this.onStreamCallback = null;
      
      console.log('WebRTC连接已关闭');
    } catch (error) {
      console.error('关闭WebRTC连接失败:', error);
    }
  }

  getConnectionState() {
    return this.peerConnection ? this.peerConnection.connectionState : 'closed';
  }

  getIceConnectionState() {
    return this.peerConnection ? this.peerConnection.iceConnectionState : 'closed';
  }
}

export default new WebRTCService();