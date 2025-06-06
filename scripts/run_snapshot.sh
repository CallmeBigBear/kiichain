#!/bin/bash

INITIAL_HALT_HEIGHT=$1
SNAPSHOT_INTERVAL=$2
CHAIN_ID=$3

systemctl stop kiichaind

sed -i -e 's/pruning = .*/pruning = "custom"/' /root/.kiichain3/config/app.toml
sed -i -e 's/pruning-keep-recent = .*/pruning-keep-recent = "1"/' /root/.kiichain3/config/app.toml
sed -i -e 's/pruning-keep-every = .*/pruning-keep-every = "0"/' /root/.kiichain3/config/app.toml
sed -i -e 's/pruning-interval = .*/pruning-interval = "1"/' /root/.kiichain3/config/app.toml

mkdir -p /root/snapshots

HALT_HEIGHT=$INITIAL_HALT_HEIGHT
while true
do
    sed -i -e 's/halt-height = .*/halt-height = '$HALT_HEIGHT'/' /root/.kiichain3/config/app.toml
    /root/go/bin/kiichaind start --trace --chain-id $CHAIN_ID
    start_time=$(date +%s)
    /root/go/bin/kiichaind tendermint snapshot $HALT_HEIGHT
    end_time=$(date +%s)
    elapsed=$(( end_time - start_time ))
	echo "Backed up snapshot for height "$HALT_HEIGHT" which took "$elapsed" seconds"
    HALT_HEIGHT=$(expr $HALT_HEIGHT + $SNAPSHOT_INTERVAL)
    cd $HOME
done
