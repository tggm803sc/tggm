#include "InventoryComponent.h"

#include "Net/UnrealNetwork.h"

UInventoryComponent::UInventoryComponent()
{
    SetIsReplicatedByDefault(true);
    PrimaryComponentTick.bCanEverTick = false;
}

bool UInventoryComponent::ServerAddItem(const FName ItemId, const int32 Quantity)
{
    AActor* Owner = GetOwner();
    if (!Owner || !Owner->HasAuthority() || ItemId.IsNone() || Quantity <= 0)
    {
        return false;
    }

    if (FInventoryStack* Existing = Items.FindByPredicate([ItemId](const FInventoryStack& Stack){ return Stack.ItemId == ItemId; }))
    {
        Existing->Quantity += Quantity;
    }
    else
    {
        FInventoryStack NewStack;
        NewStack.ItemId = ItemId;
        NewStack.Quantity = Quantity;
        Items.Add(NewStack);
    }

    BP_OnInventoryChanged();
    return true;
}

bool UInventoryComponent::ServerRemoveItem(const FName ItemId, const int32 Quantity)
{
    AActor* Owner = GetOwner();
    if (!Owner || !Owner->HasAuthority() || ItemId.IsNone() || Quantity <= 0)
    {
        return false;
    }

    FInventoryStack* Existing = Items.FindByPredicate([ItemId](const FInventoryStack& Stack){ return Stack.ItemId == ItemId; });
    if (!Existing || Existing->Quantity < Quantity)
    {
        return false;
    }

    Existing->Quantity -= Quantity;
    if (Existing->Quantity <= 0)
    {
        Items.RemoveAll([ItemId](const FInventoryStack& Stack){ return Stack.ItemId == ItemId; });
    }

    BP_OnInventoryChanged();
    return true;
}

void UInventoryComponent::OnRep_Items()
{
    BP_OnInventoryChanged();
}

void UInventoryComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(UInventoryComponent, Items);
}
