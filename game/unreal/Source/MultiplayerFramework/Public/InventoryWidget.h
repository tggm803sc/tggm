#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "InventoryWidget.generated.h"

class UInventoryComponent;

UCLASS()
class MULTIPLAYERFRAMEWORK_API UInventoryWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category="TGG|Inventory")
    void BindInventory(UInventoryComponent* InInventory);

protected:
    UPROPERTY(BlueprintReadOnly, Category="TGG|Inventory")
    TObjectPtr<UInventoryComponent> Inventory;

    UFUNCTION(BlueprintImplementableEvent, Category="TGG|Inventory")
    void BP_RefreshInventory();

    virtual void NativeConstruct() override;
};
