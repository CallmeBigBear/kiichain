package keeper

import (
	"fmt"
	"time"

	"github.com/cosmos/cosmos-sdk/codec"
	sdk "github.com/cosmos/cosmos-sdk/types"
	paramtypes "github.com/cosmos/cosmos-sdk/x/params/types"
	epochTypes "github.com/kiichain/kiichain3/x/epoch/types"
	"github.com/kiichain/kiichain3/x/mint/types"
	"github.com/tendermint/tendermint/libs/log"
)

// Keeper of the mint store
type Keeper struct {
	cdc              codec.BinaryCodec
	storeKey         sdk.StoreKey
	paramSpace       paramtypes.Subspace
	stakingKeeper    types.StakingKeeper
	bankKeeper       types.BankKeeper
	feeCollectorName string
}

// NewKeeper creates a new mint Keeper instance
func NewKeeper(
	cdc codec.BinaryCodec, key sdk.StoreKey, paramSpace paramtypes.Subspace,
	sk types.StakingKeeper, ak types.AccountKeeper, bk types.BankKeeper,
	_ types.EpochKeeper, feeCollectorName string,
) Keeper {
	// ensure mint module account is set
	if addr := ak.GetModuleAddress(types.ModuleName); addr == nil {
		panic("the mint module account has not been set")
	}

	// set KeyTable if it has not already been set
	if !paramSpace.HasKeyTable() {
		paramSpace = paramSpace.WithKeyTable(types.ParamKeyTable())
	}

	return Keeper{
		cdc:              cdc,
		storeKey:         key,
		paramSpace:       paramSpace,
		stakingKeeper:    sk,
		bankKeeper:       bk,
		feeCollectorName: feeCollectorName,
	}
}

// Logger returns a module-specific logger.
func (k Keeper) Logger(ctx sdk.Context) log.Logger {
	return ctx.Logger().With("module", "x/"+types.ModuleName)
}

// get the minter
func (k Keeper) GetMinter(ctx sdk.Context) (minter types.Minter) {
	store := ctx.KVStore(k.storeKey)
	b := store.Get(types.MinterKey)
	if b == nil {
		panic("stored minter should not have been nil")
	}

	k.cdc.MustUnmarshal(b, &minter)
	return minter
}

// set the minter
func (k Keeper) SetMinter(ctx sdk.Context, minter types.Minter) {
	store := ctx.KVStore(k.storeKey)
	b := k.cdc.MustMarshal(&minter)
	store.Set(types.MinterKey, b)
}

// GetParams returns the total set of minting parameters.
func (k Keeper) GetParams(ctx sdk.Context) (params types.Params) {
	k.paramSpace.GetParamSet(ctx, &params)
	return params
}

// SetParams sets the total set of minting parameters.
func (k Keeper) SetParams(ctx sdk.Context, params types.Params) {
	k.paramSpace.SetParamSet(ctx, &params)
}

// StakingTokenSupply implements an alias call to the underlying staking keeper's
func (k Keeper) StakingTokenSupply(ctx sdk.Context) sdk.Int {
	return k.stakingKeeper.StakingTokenSupply(ctx)
}

// BondedRatio implements an alias call to the underlying staking keeper's
func (k Keeper) BondedRatio(ctx sdk.Context) sdk.Dec {
	return k.stakingKeeper.BondedRatio(ctx)
}

// MintCoins implements an alias call to the underlying supply keeper's
// MintCoins to be used in BeginBlocker.
func (k Keeper) MintCoins(ctx sdk.Context, newCoins sdk.Coins) error {
	if newCoins.Empty() {
		// skip as no coins need to be minted
		return nil
	}

	return k.bankKeeper.MintCoins(ctx, types.ModuleName, newCoins)
}

// AddCollectedFees implements an alias call to the underlying supply keeper's
// AddCollectedFees to be used in BeginBlocker.
func (k Keeper) AddCollectedFees(ctx sdk.Context, fees sdk.Coins) error {
	return k.bankKeeper.SendCoinsFromModuleToModule(ctx, types.ModuleName, k.feeCollectorName, fees)
}

// GetProportions gets the balance of the `MintedDenom` from minted coins and returns coins according to the `AllocationRatio`.
func (k Keeper) GetOrUpdateLatestMinter(
	ctx sdk.Context,
	epoch epochTypes.Epoch,
) (types.Minter, error) {
	params := k.GetParams(ctx)
	currentReleaseMinter := k.GetMinter(ctx)
	nextScheduledRelease, err := GetNextScheduledTokenRelease(epoch, params.TokenReleaseSchedule, currentReleaseMinter)
	if err != nil {
		return types.Minter{}, err
	}

	// There's still an ongoing release (> 0 remaining amount or same start date) or there's no release scheduled
	if currentReleaseMinter.OngoingRelease() || nextScheduledRelease.GetStartDate() == currentReleaseMinter.GetStartDate() || nextScheduledRelease == nil {
		k.Logger(ctx).Debug("Ongoing token release or no nextScheduledRelease", "minter", currentReleaseMinter)
		return currentReleaseMinter, nil
	}

	// Return the new minter
	return types.NewMinter(
		nextScheduledRelease.GetStartDate(),
		nextScheduledRelease.GetEndDate(),
		params.GetMintDenom(),
		nextScheduledRelease.GetTokenReleaseAmount(),
	), nil
}

// GetCdc returns the keeper Cdc
func (k Keeper) GetCdc() codec.BinaryCodec {
	return k.cdc
}

// GetStoreKey returns the keeper store key
func (k Keeper) GetStoreKey() sdk.StoreKey {
	return k.storeKey
}

// GetParamSpace returns the keeper param space
func (k Keeper) GetParamSpace() paramtypes.Subspace {
	return k.paramSpace
}

// SetParamSpace set the keeper param space
func (k *Keeper) SetParamSpace(subspace paramtypes.Subspace) {
	k.paramSpace = subspace
}

// GetNextScheduledTokenRelease returns the start, end date and the release amount for the next epoch
func GetNextScheduledTokenRelease(
	epoch epochTypes.Epoch,
	tokenReleaseSchedule []types.ScheduledTokenRelease,
	currentMinter types.Minter,
) (*types.ScheduledTokenRelease, error) {
	for _, scheduledRelease := range tokenReleaseSchedule {
		scheduledStartDate, err := time.Parse(types.TokenReleaseDateFormat, scheduledRelease.GetStartDate())
		if err != nil {
			// This should not happen as the scheduled release date is validated when the param is updated
			return nil, fmt.Errorf("invalid scheduled release date: %s", err)
		}
		scheduledStartDateTime := scheduledStartDate.UTC()

		// If epoch is after the currentScheduled date and it's after the current release
		if epoch.GetCurrentEpochStartTime().After(scheduledStartDateTime) {
			endDate, err := currentMinter.GetEndDateTime()
			if err != nil {
				return nil, err
			}

			if scheduledStartDateTime.After(endDate) || scheduledStartDateTime.Equal(endDate) {
				return &scheduledRelease, nil
			}
		}
	}
	return nil, nil
}
