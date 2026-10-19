import { io, type Socket } from "socket.io-client";
import { apiOrigin } from "./config";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(apiOrigin(), {
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}