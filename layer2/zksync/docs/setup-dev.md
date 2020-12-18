# Prerequisites

## `Docker`

Install `docker`. It is recommended to follow the instructions from the
[official site](https://docs.docker.com/install/).

Installing `docker` via `snap` or from the default repository can cause troubles.

You need to install both `docker` and `docker-compose`.

**Note:** On linux you may encounter the following error when you'll try to work with `zksync`:

```sh
ERROR: Couldn't connect to Docker daemon - you might need to run `docker-machine start default`.
```

If so, you **do not need** to install `docker-machine`. Most probably, it means that your user is not added to the
`docker` group. You can check it as follows:

```sh
docker-compose up # Should raise the same error.
sudo docker-compose up # Should start doing things.
```

If the first command fails, but the second succeeds, then you need to add your user to the `docker` group:

```sh
sudo usermod -a -G docker your_user_name
```

After that, you should logout and login again (user groups are refreshed after the login). The problem should be solved
at this step.

## `Node` & `Yarn`

1. Install `Node` (requires version 14.13.1 or higher).

2. Install `yarn`. Instructions can be found on the [official site](https://classic.yarnpkg.com/en/docs/install/).

3. Run `yarn global add @vue/cli-service`

## `Axel`

Install `axel` for downloading keys:

On mac:

```sh
brew install axel
```

On debian-based linux:

```sh
sudo apt-get install axel
```

## `Rust`

Install the latest `rust` version.

Instructions can be found on the [official site](https://www.rust-lang.org/tools/install).

Verify the `rust` installation:

```
rustc --version
rustc 1.41.0 (5e1a79984 2020-01-27)
```

### `lld`

Optionally, you may want to optimize the build time with the LLVM linker, `lld`.\
Make sure you have it installed and append `"-C", "link-arg=-fuse-ld=lld"` to the `rustflags` in your `.cargo/config` file,
so it looks like this:

```
[target.x86_64-unknown-linux-gnu]
rustflags = [
    "-C", "link-arg=-fuse-ld=lld",
]
```

**Warning:** This is only viable for linux since `lld` doesn't work on mac.

## PSQL

Install `psql` CLI tool to interact with postgres.

On debian-based linux:

```sh
sudo apt-get install postgresql-client
```

## `Diesel` CLI

Install [`diesel`](https://diesel.rs/) CLI (it is used for migrations management only):

```sh
cargo install diesel_cli --no-default-features --features postgres
```

If at the install step you get the linkage errors, install the development version of `libpq`.

On debian-based linux:

```sh
sudo apt-get install libpq-dev
```

## `sqlx` CLI

Also, we need [`sqlx`](https://github.com/launchbadge/sqlx) CLI (it is used to generate database wrappers):

```sh
cargo install --version=0.2.0 sqlx-cli
```

## `solc`

You have to install `solc` v0.5.16. Instructions can be found at
[readthedocs](https://solidity.readthedocs.io/en/v0.6.2/installing-solidity.html).

The simplest option for linux is to use `snap`.

For mac you can install it as follows:

```sh
brew update
brew upgrade
brew tap ethereum/ethereum
brew install solidity@5
```

## drone cli

drone cli used to create promotion jobs [described here](docs/promote.md) <https://docs.drone.io/cli/install/>

## Environment

Edit the lines below and add them to your shell profile file (e.g. `~/.bash_profile`):

```sh
# Add path here:
export ZKSYNC_HOME=/path/to/zksync

export PATH=$ZKSYNC_HOME/bin:$PATH

# If you're like me, uncomment:
# cd $ZKSYNC_HOME
```
