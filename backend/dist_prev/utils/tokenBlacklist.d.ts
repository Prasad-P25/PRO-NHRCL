declare class TokenBlacklist {
    private blacklist;
    private cleanupInterval;
    constructor();
    add(token: string, expiresInMs?: number): void;
    isBlacklisted(token: string): boolean;
    private cleanup;
    size(): number;
    clear(): void;
}
export declare const tokenBlacklist: TokenBlacklist;
export {};
//# sourceMappingURL=tokenBlacklist.d.ts.map