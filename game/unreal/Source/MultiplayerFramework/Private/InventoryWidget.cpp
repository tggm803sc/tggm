#include "InventoryWidget.h"

#include "InventoryComponent.h"

void UInventoryWidget::NativeConstruct()
{
    Super::NativeConstruct();
    BP_RefreshInventory();
}

void UInventoryWidget::BindInventory(UInventoryComponent* InInventory)
{
    if (Inventory == InInventory)
    {
        return;
    }

    Inventory = InInventory;
    BP_RefreshInventory();
}
