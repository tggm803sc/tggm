#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "InventoryComponent.generated.h"

USTRUCT(BlueprintType)
struct FInventoryStack
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName ItemId;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 Quantity = 0;
};

UCLASS(ClassGroup=(TGG), meta=(BlueprintSpawnableComponent))
class MULTIPLAYERFRAMEWORK_API UInventoryComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UInventoryComponent();

    UFUNCTION(BlueprintCallable, Category="TGG|Inventory")
    bool ServerAddItem(FName ItemId, int32 Quantity);

    UFUNCTION(BlueprintCallable, Category="TGG|Inventory")
    bool ServerRemoveItem(FName ItemId, int32 Quantity);

    UFUNCTION(BlueprintPure, Category="TGG|Inventory")
    const TArray<FInventoryStack>& GetItems() const { return Items; }

protected:
    UPROPERTY(ReplicatedUsing=OnRep_Items)
    TArray<FInventoryStack> Items;

    UFUNCTION()
    void OnRep_Items();

    UFUNCTION(BlueprintImplementableEvent, Category="TGG|Inventory")
    void BP_OnInventoryChanged();

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
