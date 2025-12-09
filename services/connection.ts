
import Peer, { DataConnection } from 'peerjs';
import { DataPacket } from '../types';

// We use the imported Peer class. 
// Note: Depending on the environment/bundler, Peer might be a default export or named.
// The importmap setup usually provides the class as default.

let peer: any = null;
let connections: DataConnection[] = [];
let hostConnection: DataConnection | null = null;
let isHost = false;
let keepAliveInterval: any = null;

// Generate a random 4-character ID (e.g. A2B9)
const generateId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 1, 0
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const startKeepAlive = () => {
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  // Send a 'ping' every 10 seconds to keep connection open on mobile
  keepAliveInterval = setInterval(() => {
    if (isHost) {
      connections.forEach(conn => {
        if (conn && conn.open) {
            try {
                conn.send({ type: 'PING', payload: null });
            } catch(e) {
                // Connection likely closed
            }
        }
      });
    } else if (hostConnection && hostConnection.open) {
      try {
          hostConnection.send({ type: 'PING', payload: null });
      } catch(e) {
          // Connection likely closed
      }
    }
  }, 10000);
};

const stopKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
};

// Start as HOST (CIOSP)
export const initializeHost = (
  onData: (data: DataPacket) => void,
  onConnectionsUpdate?: (count: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const id = generateId();
    // Prefix ID to avoid collisions on public PeerJS server
    const peerId = `CIOSP-APP-${id}`;
    
    // @ts-ignore - PeerJS import handling can be tricky with ESM/CDN
    if (typeof Peer === 'undefined') {
        reject(new Error("Erro interno: Biblioteca PeerJS não carregada. Recarregue a página."));
        return;
    }

    try {
        // @ts-ignore
        peer = new Peer(peerId, {
            debug: 0 // Reduce debug logs to avoid console clutter
        });
    } catch (e) {
        reject(new Error("Falha ao iniciar conexão P2P."));
        return;
    }

    peer.on('open', (id: string) => {
      isHost = true;
      console.log('Host opened with ID:', id);
      startKeepAlive();
      // Return just the display code
      resolve(id.replace('CIOSP-APP-', ''));
    });

    peer.on('connection', (conn: DataConnection) => {
      // Wait for open to add to active list
      conn.on('open', () => {
        connections.push(conn);
        if (onConnectionsUpdate) onConnectionsUpdate(connections.length);
      });

      conn.on('data', (data: any) => {
        // Filter out PINGs
        if (data && data.type !== 'PING') {
           onData(data as DataPacket);
        }
      });

      conn.on('close', () => {
        connections = connections.filter(c => c !== conn);
        if (onConnectionsUpdate) onConnectionsUpdate(connections.length);
      });
      
      conn.on('error', (err: any) => {
          // Silent catch for individual connection errors
          connections = connections.filter(c => c !== conn);
          if (onConnectionsUpdate) onConnectionsUpdate(connections.length);
      });
    });

    peer.on('disconnected', () => {
        // Connection to signaling server lost (common on mobile)
        // Try to reconnect immediately
        if (!peer || peer.destroyed) return;
        setTimeout(() => {
            try {
                if (peer && !peer.destroyed && !peer.disconnected) return;
                if (peer && !peer.destroyed) peer.reconnect();
            } catch (e) { 
                console.warn("Reconnect attempt failed", e);
            }
        }, 1000);
    });

    peer.on('error', (err: any) => {
      // Suppress network errors from bubbling up as "Uncaught"
      if (err.type === 'peer-unavailable' || err.type === 'network' || err.type === 'server-error' || err.message?.includes('Lost connection')) {
          console.warn('Network fluctuation handled:', err.message);
          return;
      }
      
      console.error('Peer error:', err);
      // Only reject if it's an initialization error (id in use)
      if (err.type === 'unavailable-id') {
          reject(new Error("ID em uso. Tente novamente."));
      }
    });
  });
};

// Connect as CLIENT (Unit)
export const connectToHost = (displayId: string, onData: (data: DataPacket) => void): Promise<void> => {
  return new Promise((resolve, reject) => {
    const peerId = `UNIT-${generateId()}-${Date.now().toString().slice(-4)}`;
    const hostPeerId = `CIOSP-APP-${displayId.toUpperCase()}`;

    // @ts-ignore
    if (typeof Peer === 'undefined') {
        reject(new Error("Erro interno: Biblioteca PeerJS não carregada. Recarregue a página."));
        return;
    }

    try {
        // @ts-ignore
        peer = new Peer(peerId, {
            debug: 0
        });
    } catch (e) {
        reject(new Error("Falha ao iniciar cliente P2P."));
        return;
    }

    peer.on('open', () => {
      const conn = peer.connect(hostPeerId, { reliable: true });

      conn.on('open', () => {
        isHost = false;
        hostConnection = conn;
        startKeepAlive();
        console.log('Connected to Host');
        resolve();
      });

      conn.on('data', (data: any) => {
        if (data && data.type !== 'PING') {
           onData(data as DataPacket);
        }
      });

      conn.on('close', () => {
        hostConnection = null;
        console.warn('Conexão com CIOSP encerrada.');
      });

      conn.on('error', (err: any) => {
          // Handled by peer error
      });
      
      peer.on('error', (err: any) => {
        if (err.type === 'peer-unavailable') {
            reject(new Error("CIOSP não encontrado. Verifique o código."));
        }
      });
    });

    peer.on('disconnected', () => {
        if (!peer || peer.destroyed) return;
        setTimeout(() => {
            try {
                if (peer && !peer.destroyed && !peer.disconnected) return;
                if (peer && !peer.destroyed) peer.reconnect();
            } catch (e) { console.warn("Reconnect failed", e); }
        }, 1000);
    });
    
    peer.on('error', (err: any) => {
         // Suppress network errors from bubbling up as "Uncaught"
         if (err.type === 'peer-unavailable' || err.type === 'network' || err.type === 'server-error' || err.message?.includes('Lost connection')) {
            console.warn('Network fluctuation handled:', err.message);
            return;
        }
        console.error("Peer fatal error", err);
    });
  });
};

// Send data to everyone (if Host)
export const broadcastData = (packet: DataPacket) => {
  if (!isHost) return;
  connections.forEach(conn => {
    // Check strict openness
    if (conn && conn.open) {
      try {
        conn.send(packet);
      } catch (e) {
        // Ignore send errors
      }
    }
  });
};

// Send command to Host (if Client)
export const sendCommand = (packet: DataPacket) => {
  if (isHost) return; // Host executes locally
  if (hostConnection && hostConnection.open) {
    try {
        hostConnection.send(packet);
    } catch (e) {
        console.warn("Send command failed", e);
    }
  }
};

export const destroyConnection = () => {
  stopKeepAlive();
  if (peer) {
    try {
        peer.destroy();
    } catch(e) {}
    peer = null;
  }
  connections = [];
  hostConnection = null;
  isHost = false;
};
