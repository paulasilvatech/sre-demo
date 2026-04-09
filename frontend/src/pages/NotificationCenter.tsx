import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  htmlMessage?: string;
  timestamp: string;
  read: boolean;
}

// BUG: Mutable global state outside React
let globalNotificationCount = 0;
let allNotifications: Notification[] = [];

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [wsUrl, setWsUrl] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  // BUG: Unused state
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);

  // BUG: Memory leak - WebSocket connection never properly closed
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/notifications');

    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      // BUG: Mutating global state directly
      allNotifications.push(notification);
      globalNotificationCount++;
      setNotifications([...allNotifications]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // BUG: No reconnection logic
    };

    socketRef.current = ws;
    // Missing cleanup: return () => ws.close();
  }, []);

  // BUG: Infinite re-render - notifications changes trigger this effect which changes notifications
  useEffect(() => {
    if (notifications.length > 0) {
      const sorted = [...notifications].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      // BUG: This causes infinite loop - setting state that's in dependency array
      // setNotifications(sorted);
    }
  }, [notifications]);

  // BUG: Missing dependency on filter
  const filteredNotifications = React.useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter(n => n.type === filter);
  }, [notifications]); // Missing: filter

  // VULNERABILITY: innerHTML from server-supplied HTML
  const renderNotification = (notification: Notification) => {
    return (
      <div
        key={notification.id}
        className={`notification ${notification.type} p-3 mb-2 rounded border`}
      >
        {notification.htmlMessage ? (
          // VULNERABILITY: XSS - rendering server HTML without sanitization
          <div dangerouslySetInnerHTML={{ __html: notification.htmlMessage }} />
        ) : (
          <p>{notification.message}</p>
        )}
        <small className="text-gray-500">{notification.timestamp}</small>
      </div>
    );
  };

  // VULNERABILITY: Connecting to arbitrary WebSocket URL from user input
  const connectToCustomWs = () => {
    if (wsUrl) {
      // VULNERABILITY: No URL validation - could connect to malicious server
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        // VULNERABILITY: Parsing and executing arbitrary data from untrusted source
        const data = JSON.parse(event.data);
        if (data.script) {
          eval(data.script); // VULNERABILITY: Remote code execution via eval
        }
      };
      socketRef.current = ws;
    }
  };

  // BUG: Race condition - markAsRead doesn't handle concurrent updates
  const markAsRead = async (id: string) => {
    // BUG: Optimistic update without rollback on failure
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );

    // BUG: No error handling
    await api.patch(`/notifications/${id}`, { read: true });

    // BUG: Also mutating global state
    const globalIdx = allNotifications.findIndex(n => n.id === id);
    if (globalIdx >= 0) {
      allNotifications[globalIdx].read = true;
    }
  };

  // BUG: Clearing all without API call
  const clearAll = () => {
    allNotifications = [];
    globalNotificationCount = 0;
    setNotifications([]);
    // Missing: API call to clear on server
  };

  // BUG: Inefficient - creates new function on every render
  const getUnreadCount = () => {
    return notifications.filter(n => !n.read).length;
  };

  return (
    <div className="notification-center p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">
          Notifications ({getUnreadCount()} unread)
        </h1>
        <div className="flex gap-2">
          <button onClick={clearAll} className="bg-red-500 text-white px-3 py-1 rounded text-sm">
            Clear All
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['all', 'info', 'warning', 'error', 'success'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm ${filter === f ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Custom WS connection - VULNERABILITY */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
          placeholder="Custom WebSocket URL..."
          className="border rounded p-2 flex-1"
        />
        <button
          onClick={connectToCustomWs}
          className="bg-purple-500 text-white px-4 py-2 rounded"
        >
          Connect
        </button>
      </div>

      {/* Notification list */}
      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No notifications</p>
        ) : (
          filteredNotifications.map(renderNotification)
        )}
      </div>

      {/* Debug info - VULNERABILITY: Exposing internal state */}
      <div className="debug-info mt-6 p-4 bg-gray-100 rounded text-xs">
        <pre>{JSON.stringify({
          globalCount: globalNotificationCount,
          socketState: socketRef.current?.readyState,
          wsUrl: socketRef.current?.url,
          filter,
          totalNotifications: notifications.length,
        }, null, 2)}</pre>
      </div>
    </div>
  );
}

export default NotificationCenter;
