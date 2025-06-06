package keeper_test

import (
	"testing"

	sdk "github.com/cosmos/cosmos-sdk/types"
	testkeeper "github.com/kiichain/kiichain/testutil/keeper"
	"github.com/kiichain/kiichain/x/epoch/types"
	"github.com/stretchr/testify/require"
)

func TestEpochQuery(t *testing.T) {
	keeper, ctx := testkeeper.EpochKeeper(t)
	wctx := sdk.WrapSDKContext(ctx)
	epoch := types.DefaultEpoch()
	keeper.SetEpoch(ctx, *epoch)

	response, err := keeper.Epoch(wctx, &types.QueryEpochRequest{})
	require.NoError(t, err)
	require.Equal(t, &types.QueryEpochResponse{Epoch: *epoch}, response)
}
