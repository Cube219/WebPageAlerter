import { APIServer } from "./APIServer";

const api = new APIServer({
    port: 443,
    keyPath: "self.key",
    certPath: "self.crt"
});
api.start();
