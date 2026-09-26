#include "EquipmentComponent.h"

#include "Components/SkeletalMeshComponent.h"
#include "GameFramework/Character.h"
#include "Net/UnrealNetwork.h"

UEquipmentComponent::UEquipmentComponent()
{
    SetIsReplicatedByDefault(true);
    PrimaryComponentTick.bCanEverTick = false;
}

bool UEquipmentComponent::ServerEquipActor(AActor* EquipmentActor, const FName SocketName)
{
    ACharacter* Character = Cast<ACharacter>(GetOwner());
    if (!Character || !Character->HasAuthority() || !IsValid(EquipmentActor) || SocketName.IsNone())
    {
        return false;
    }

    EquippedActor = EquipmentActor;
    EquippedSocket = SocketName;
    AttachCurrent();
    return true;
}

void UEquipmentComponent::ServerUnequip()
{
    AActor* Owner = GetOwner();
    if (!Owner || !Owner->HasAuthority())
    {
        return;
    }

    if (IsValid(EquippedActor))
    {
        EquippedActor->DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
    }

    EquippedActor = nullptr;
    EquippedSocket = NAME_None;
}

void UEquipmentComponent::OnRep_Equipment()
{
    AttachCurrent();
}

void UEquipmentComponent::AttachCurrent()
{
    ACharacter* Character = Cast<ACharacter>(GetOwner());
    if (!Character || !IsValid(EquippedActor))
    {
        return;
    }

    EquippedActor->AttachToComponent(
        Character->GetMesh(),
        FAttachmentTransformRules::SnapToTargetNotIncludingScale,
        EquippedSocket);
}

void UEquipmentComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(UEquipmentComponent, EquippedActor);
    DOREPLIFETIME(UEquipmentComponent, EquippedSocket);
}
