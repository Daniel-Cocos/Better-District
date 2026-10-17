# Backend

First populate the sqlite database:

```sh
make seed
```

From `backend/`, enter the environment and start the server:

```sh
nix develop path:.
make dev
```

Server: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
