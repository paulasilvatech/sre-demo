import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

// VULNERABILITY: Hardcoded credentials in frontend code
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.admin-token-hardcoded';
const API_INTERNAL_KEY = 'frontend-internal-api-key-12345';

interface Comment {
  id: string;
  author: string;
  content: string;
  htmlContent?: string;
  createdAt: string;
}

interface AdminStats {
  users: number;
  todos: number;
  projects: number;
}

export function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [configData, setConfigData] = useState<string>('');
  const [pollingInterval, setPollingInterval] = useState<number>(5000);
  // BUG: Unused state variables
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempData, setTempData] = useState(null);
  const [debugMode, setDebugMode] = useState(true);

  // BUG: Missing dependency array - runs on EVERY render
  useEffect(() => {
    fetchUsers();
    fetchStats();
  });

  // BUG: Memory leak - interval is never cleared
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      console.log('Polling stats...', new Date().toISOString());
    }, pollingInterval);
    // Missing cleanup: return () => clearInterval(interval);
  }, []);

  // BUG: Another memory leak - event listener never removed
  useEffect(() => {
    const handleResize = () => {
      console.log('Window resized:', window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    // Missing cleanup: return () => window.removeEventListener('resize', handleResize);
  }, []);

  // BUG: Stale closure - references outdated searchQuery
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery) {
        // This will always use the initial searchQuery value due to missing dep
        fetchUsers(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, []); // Missing searchQuery in dependency array

  const fetchUsers = async (query?: string) => {
    try {
      // VULNERABILITY: Sending hardcoded token in request
      const response = await api.get('/admin/users', {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
        params: { search: query },
      });
      setUsers(response.data.users);
    } catch (e) {
      // BUG: Silently swallowing error
    }
  };

  const fetchStats = async () => {
    const response = await api.get('/admin/config', {
      headers: { 'X-API-Key': API_INTERNAL_KEY },
    });
    setStats(response.data);
  };

  // VULNERABILITY: XSS via dangerouslySetInnerHTML
  const renderComment = (comment: Comment) => {
    return (
      <div key={comment.id} className="comment">
        <strong>{comment.author}</strong>
        {/* VULNERABILITY: Direct HTML injection from user content */}
        <div dangerouslySetInnerHTML={{ __html: comment.htmlContent || comment.content }} />
        <span>{comment.createdAt}</span>
      </div>
    );
  };

  // VULNERABILITY: Using eval to parse config
  const loadConfig = () => {
    try {
      // VULNERABILITY: eval() on user-controlled data
      const parsed = eval('(' + configData + ')');
      console.log('Config loaded:', parsed);
      return parsed;
    } catch (e) {
      console.error('Invalid config');
    }
  };

  // VULNERABILITY: Storing sensitive data in localStorage
  const saveSession = () => {
    localStorage.setItem('admin_token', ADMIN_TOKEN);
    localStorage.setItem('api_key', API_INTERNAL_KEY);
    localStorage.setItem('user_data', JSON.stringify(users));
    // VULNERABILITY: Password stored in localStorage
    localStorage.setItem('admin_password', 'admin123');
  };

  // BUG: Unsafe type assertion
  const getUserRole = (user: any): string => {
    return (user as any).role.name.toUpperCase(); // Will crash if role is undefined
  };

  // BUG: Creating functions inside render (performance issue)
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // BUG: Calling fetchUsers directly on every keystroke (no debounce despite the effect above)
    fetchUsers(e.target.value);
  };

  // VULNERABILITY: URL construction from user input without validation
  const openExternalLink = (userInput: string) => {
    // VULNERABILITY: Open redirect / javascript: URL injection
    window.location.href = userInput;
  };

  return (
    <div className="admin-panel p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>

      {/* Search with direct API calls on every keystroke */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={handleSearch}
          className="border rounded p-2 w-full"
        />
      </div>

      {/* VULNERABILITY: Rendering unsanitized user data */}
      <div className="users-list">
        {users.map((user: any) => (
          <div key={user.id} className="user-card p-4 border rounded mb-2">
            {/* VULNERABILITY: XSS via innerHTML */}
            <h3 dangerouslySetInnerHTML={{ __html: user.name }} />
            <p>{user.email}</p>
            {/* BUG: Calling function that will crash on undefined */}
            <span className="badge">{getUserRole(user)}</span>
            {/* VULNERABILITY: Open redirect */}
            <button onClick={() => openExternalLink(user.website)}>
              Visit Website
            </button>
          </div>
        ))}
      </div>

      {/* Config editor with eval */}
      <div className="config-section mt-6">
        <h2 className="text-xl font-bold mb-2">Configuration</h2>
        <textarea
          value={configData}
          onChange={(e) => setConfigData(e.target.value)}
          className="border rounded p-2 w-full h-32"
          placeholder="Enter JSON config..."
        />
        <button onClick={loadConfig} className="mt-2 bg-blue-500 text-white px-4 py-2 rounded">
          Load Config (eval)
        </button>
        <button onClick={saveSession} className="mt-2 ml-2 bg-green-500 text-white px-4 py-2 rounded">
          Save Session
        </button>
      </div>

      {/* Comments with XSS */}
      <div className="comments-section mt-6">
        <h2 className="text-xl font-bold mb-2">Comments</h2>
        {comments.map(renderComment)}
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats mt-6 grid grid-cols-3 gap-4">
          <div className="stat-card p-4 bg-gray-100 rounded">
            <div className="text-3xl font-bold">{(stats as any).users}</div>
            <div>Users</div>
          </div>
          <div className="stat-card p-4 bg-gray-100 rounded">
            <div className="text-3xl font-bold">{(stats as any).todos}</div>
            <div>Todos</div>
          </div>
          <div className="stat-card p-4 bg-gray-100 rounded">
            <div className="text-3xl font-bold">{(stats as any).projects}</div>
            <div>Projects</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
