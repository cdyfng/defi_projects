# Launching zkSync

This document covers common scenarios of launching zkSync applications set locally.

## Prerequisites

Prepare dev environment prerequisites: see [setup-dev.md](setup-dev.md).

## Setup local dev environment

Setup:

```sh
zk   # installs and builds zk itself
zk init
```

During the first initialization you have to download around 8 GB of setup files, this should be done once. If you have a
problem on this step of the initialization, see help for the `zk run plonk-setup` command.

To completely reset the dev environment:

- Stop services:

  ```sh
  zk down
  ```

- Repeat the setup procedure above

If `zk init` has already been executed, and now you only need to start docker containers (e.g. after reboot), simply
launch:

```sh
zk up
```

## (Re)deploy db and contraсts

```sh
zk contract redeploy
```

## Environment configurations

Env config files are held in `etc/env/`

List configurations:

```sh
zk env
```

Switch between configurations:

```sh
zk env <ENV_NAME>
```

Default confiruration is `dev.env`, which is generated automatically from `dev.env.example` during `zk init` command
execution.

## Build and run server + prover locally for development

Run server:

```sh
zk server
```

Server is configured using env files in `./etc/env` directory. After the first initialization, file `./etc/env/dev.env`
will be created. By default, this file is copied from the `./etc/env/dev.env.example` template.

Server can produce block of different sizes, the list of available sizes is determined by the
`SUPPORTED_BLOCK_CHUNKS_SIZES` environment variable. Block sizes which will actually be produced by the server can be
configured using the `BLOCK_CHUNK_SIZES` environment variable.

Note: for proof generation for large blocks requires a lot of resources and an average user machine is only capable of
creating proofs for the smallest block sizes. As an alternative, a dummy-prover may be used for development (see
[`development.md`](development.md) for details).

Run prover:

```sh
zk prover
```

Make sure you have environment variables set right, you can check it by running: `zk env`. You should see `* dev` in
output.
