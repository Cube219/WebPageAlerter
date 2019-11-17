# WebPageAlerter: An alerting server when a new article appears

## Getting start

### 1. Installation

#### Using Docker

```bash
$ git clone https://github.com/Cube219/WebPageAlerter.git
$ cd WebPageAlerter
$ sudo docker build -t cube219/wpa-server:latest .
```

#### Using npm

```bash
$ git clone https://github.com/Cube219/WebPageAlerter.git
$ cd WebPageAlerter
$ npm install
$ tsc
```

### 2. Setting environment variables

| Environment Variable     | Default                        | Desc                                                         |
| ------------------------ | ------------------------------ | ------------------------------------------------------------ |
| API_SERVER_PORT          | 80(In http)<br />443(In http2) | An APIServer port.                                           |
| API_SERVER_USE_HTTP2     | False                          | Use http/2 for APIServer.<br />If you enable this, you must set **API_SERVER_KEY_PATH** and **API_SERVER_CERT_PATH**. |
| API_SERVER_KEY_PATH      | undefined                      | A private key for http/2.                                    |
| API_SERVER_CERT_PATH     | undefined                      | A certificate key for http/2.                                |
| DB_URL                   | localhost                      | A mongoDB address to access it.                              |
| DB_PORT                  | 27017                          | A mongoDB port to access it.                                 |
| API_SERVER_ENABLE_AUTH   | False                          | Use authentication for APIServer.<br />If you enable this, you must set **API_SERVER_PASSWORD** and **JWT_SIGNATURE_SECRET_KEY**, and put the token in **x-access-token** of the header. |
| API_SERVER_PASSWORD      | undefined                      | A password to get the access token.                          |
| JWT_SIGNATURE_SECRET_KEY | undefined                      | A key to sign a json web token.<br />It must not changed after setting. If it is changed, all previous tokens will be unavailable. |

You can use .env*(dotenv)* file to set environment variables.

### 3. Running

#### Using Node.js

Just execute `dist/main.js`.

#### Using Docker

Just run the container you built.

To avoid deleting logs and page data whenever restarting container, mount volumes `/app/WebPageAlerter/logs` and `/app/WebPageAlerter/page_data` in container.

I recommend to use [docker-compose](https://docs.docker.com/compose/) to run it.

#### Example using docker-compose

```com
version: '3'

services:
  mainserver:
    image: "cube219/wpa-server:latest"
    container_name: wpa-server
    depends_on:
      - mongodb
    ports:
      - "8000:8000"
    volumes:
      - ./logs:/app/WebPageAlerter/logs
      - ./page_data:/app/WebPageAlerter/page_data
    environment:
      API_SERVER_PORT: 8000
      API_SERVER_USE_HTTP2: 'false'

      API_SERVER_ENABLE_AUTH: 'true'
      API_SERVER_PASSWORD: password
      JWT_SIGNATURE_SECRET_KEY: jwtsignkey

      DB_URL: mongodb
      DB_PORT: 27017
    networks:
      - backend
  mongodb:
    image: "mongo:latest"
    container_name: wpa-db
    hostname: mongodb
    volumes:
      - ./db_data:/data/db
    networks:
      - backend
```

In bash:

```bash
$ docker-compose -f compose.yml up -d
```

## License

MIT License

