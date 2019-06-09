import { APIServerInitializer, APIServer } from "./APIServer";

const apiInit: APIServerInitializer = {
    port: 443,
    keyPath: "self.key",
    certPath: "self.crt"
}

const api = new APIServer(apiInit);
api.start();
