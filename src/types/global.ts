declare global {
  var websocketService:
    | {
        sendToUser(userId: string, event: string, data: any): void;
        broadcastToAll(event: string, data: any): void;
      }
    | undefined;
}

export {};
