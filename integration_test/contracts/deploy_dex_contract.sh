#!/bin/bash

kiichaindbin=$(which ~/go/bin/kiichaind | tr -d '"')
keyname=$(printf "12345678\n" | $kiichaindbin keys list --output json | jq ".[0].name" | tr -d '"')
chainid=$($kiichaindbin status | jq ".NodeInfo.network" | tr -d '"')
kiihome=$(git rev-parse --show-toplevel | tr -d '"')
contract_name=$1
if [[ $# -ne 1 ]];
then
  echo "Need to provide a contract name (mars,saturn,venus)"
  exit 1
fi

cd $kiihome || exit
echo "Deploying $contract_name contract..."

# store
echo "Storing contract..."
store_result=$(printf "12345678\n" | $kiichaindbin tx wasm store integration_test/contracts/"$contract_name".wasm -y --from="$keyname" --chain-id="$chainid" --gas=5000000 --fees=1000000ukii --broadcast-mode=block --output=json)
contract_id=$(echo "$store_result" | jq -r '.logs[].events[].attributes[] | select(.key == "code_id").value')
echo "Got contract id $contract_id"

# instantiate
echo "Instantiating contract..."
instantiate_result=$(printf "12345678\n" | $kiichaindbin tx wasm instantiate "$contract_id" '{}' -y --no-admin --from="$keyname" --chain-id="$chainid" --gas=5000000 --fees=1000000ukii --broadcast-mode=block --label=dex --output=json)
contract_addr=$(echo "$instantiate_result" |jq -r '.logs[].events[].attributes[] | select(.key == "_contract_address").value')

# register
echo "Registering contract..."
printf "12345678\n" | $kiichaindbin tx dex register-contract "$contract_addr" "$contract_id" false true 100000000000 -y --from="$keyname" --chain-id="$chainid" --fees=100000000000ukii --gas=500000 --broadcast-mode=block

echo '{"batch_contract_pair":[{"contract_addr":"'$contract_addr'","pairs":[{"price_denom":"KII","asset_denom":"ATOM","price_tick_size":"0.0000001", "quantity_tick_size":"0.0000001"}]}]}' > integration_test/contracts/"$contract_name"-pair.json
contract_pair=$(printf "12345678\n" | $kiichaindbin tx dex register-pairs integration_test/contracts/"$contract_name"-pair.json -y --from=$keyname --chain-id=$chainid --fees=10000000ukii --gas=500000 --broadcast-mode=block --output=json)
rm -rf integration_test/contracts/"$contract_name"-pair.json

echo '{"batch_contract_pair":[{"contract_addr":"'$contract_addr'","pairs":[{"price_denom":"ukii","asset_denom":"uatom","price_tick_size":"0.0000001", "quantity_tick_size":"0.0000001"}]}]}' > integration_test/contracts/"$contract_name"-pair.json
contract_pair=$(printf "12345678\n" | $kiichaindbin tx dex register-pairs integration_test/contracts/"$contract_name"-pair.json -y --from=$keyname --chain-id=$chainid --fees=10000000ukii --gas=500000 --broadcast-mode=block --output=json)
rm -rf integration_test/contracts/"$contract_name"-pair.json

echo '{"batch_contract_pair":[{"contract_addr":"'$contract_addr'","pairs":[{"price_denom":"ukii","asset_denom":"uatomatom","price_tick_size":"0.0000001", "quantity_tick_size":"0.0000001"}]}]}' > integration_test/contracts/"$contract_name"-pair.json
contract_pair=$(printf "12345678\n" | $kiichaindbin tx dex register-pairs integration_test/contracts/"$contract_name"-pair.json -y --from=$keyname --chain-id=$chainid --fees=10000000ukii --gas=500000 --broadcast-mode=block --output=json)
rm -rf integration_test/contracts/"$contract_name"-pair.json

echo '{"batch_contract_pair":[{"contract_addr":"'$contract_addr'","pairs":[{"price_denom":"ukii","asset_denom":"uatomatomatom","price_tick_size":"0.0000001", "quantity_tick_size":"0.0000001"}]}]}' > integration_test/contracts/"$contract_name"-pair.json
contract_pair=$(printf "12345678\n" | $kiichaindbin tx dex register-pairs integration_test/contracts/"$contract_name"-pair.json -y --from=$keyname --chain-id=$chainid --fees=10000000ukii --gas=500000 --broadcast-mode=block --output=json)
rm -rf integration_test/contracts/"$contract_name"-pair.json


sleep 10

echo "Deployed contracts:"
echo "$contract_addr"
echo "$contract_addr" > $kiihome/integration_test/contracts/"$contract_name"-addr.txt

exit 0
