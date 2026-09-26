#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "EquipmentComponent.generated.h"

UCLASS(ClassGroup=(TGG), meta=(BlueprintSpawnableComponent))
class MULTIPLAYERFRAMEWORK_API UEquipmentComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UEquipmentComponent();

    UFUNCTION(BlueprintCallable, Category="TGG|Equipment")
    bool ServerEquipActor(AActor* EquipmentActor, FName SocketName);

    UFUNCTION(BlueprintCallable, Category="TGG|Equipment")
    void ServerUnequip();

    UFUNCTION(BlueprintPure, Category="TGG|Equipment")
    AActor* GetEquippedActor() const { return EquippedActor.Get(); }

protected:
    UPROPERTY(ReplicatedUsing=OnRep_Equipment)
    TObjectPtr<AActor> EquippedActor;

    UPROPERTY(Replicated)
    FName EquippedSocket;

    UFUNCTION()
    void OnRep_Equipment();

    void AttachCurrent();

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
