# tcp-handshake

800×450 canvas, 10s explainer that loops. Two labelled hosts, "Client" on the left and "Server" on the right, each with a vertical timeline line beneath it. Three packets animate in sequence as arrows travelling diagonally down between the timelines: SYN (seq=100) client→server, SYN-ACK (seq=300, ack=101) server→client, ACK (seq=101, ack=301) client→server. Each packet's label appears as it travels. A caption bar at the bottom changes text per phase: "1. Client asks to connect", "2. Server agrees", "3. Connection established". Each host has a state badge that changes: Client CLOSED → SYN_SENT → ESTABLISHED, Server LISTEN → SYN_RECEIVED → ESTABLISHED; ESTABLISHED badges turn green. Hold the final state, then fade everything out and restart.

## Change

After the handshake, add two more phases before the hold-and-fade ending: the client sends a DATA packet (seq=101, len=50) and the server replies with an ACK (ack=151). Add captions "4. Client sends data" and "5. Server acknowledges". Extend the total to 14s, keeping the same hold and fade-out at the end. Existing phases should keep their current timing.
