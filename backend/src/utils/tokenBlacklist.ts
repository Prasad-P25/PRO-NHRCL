// In-memory token blacklist
// Tokens are automatically removed after they would have expired anyway
// For a distributed system, use Redis instead

interface BlacklistedToken {
  token: string;
  expiresAt: number;
}

class TokenBlacklist {
  private blacklist: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired tokens every hour
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  // Add a token to the blacklist
  add(token: string, expiresInMs: number = 24 * 60 * 60 * 1000): void {
    const expiresAt = Date.now() + expiresInMs;
    this.blacklist.set(token, expiresAt);
  }

  // Check if a token is blacklisted
  isBlacklisted(token: string): boolean {
    const expiresAt = this.blacklist.get(token);
    if (!expiresAt) return false;

    // If expired, remove it and return false
    if (Date.now() > expiresAt) {
      this.blacklist.delete(token);
      return false;
    }

    return true;
  }

  // Remove expired tokens
  private cleanup(): void {
    const now = Date.now();
    for (const [token, expiresAt] of this.blacklist.entries()) {
      if (now > expiresAt) {
        this.blacklist.delete(token);
      }
    }
  }

  // Get blacklist size (for monitoring)
  size(): number {
    return this.blacklist.size;
  }

  // Clear all tokens (for testing)
  clear(): void {
    this.blacklist.clear();
  }
}

// Singleton instance
export const tokenBlacklist = new TokenBlacklist();
