#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "WeaponCombatComponent.generated.h"

UCLASS(ClassGroup=(TGG), meta=(BlueprintSpawnableComponent))
class MULTIPLAYERFRAMEWORK_API UWeaponCombatComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UWeaponCombatComponent();

    UFUNCTION(BlueprintCallable, Category="TGG|Combat")
    bool RequestFire();

    UFUNCTION(BlueprintCallable, Category="TGG|Combat")
    void ServerGrantAmmo(int32 Amount);

    UFUNCTION(BlueprintPure, Category="TGG|Combat")
    int32 GetAmmo() const { return CurrentAmmo; }

protected:
    UPROPERTY(EditDefaultsOnly, Category="TGG|Combat", meta=(ClampMin="0"))
    int32 MaxAmmo = 30;

    UPROPERTY(EditDefaultsOnly, Category="TGG|Combat", meta=(ClampMin="0.01"))
    float FireIntervalSeconds = 0.1f;

    UPROPERTY(ReplicatedUsing=OnRep_Ammo)
    int32 CurrentAmmo = 30;

    double LastServerFireTime = -1000.0;

    UFUNCTION(Server, Reliable)
    void ServerRequestFire();

    UFUNCTION()
    void OnRep_Ammo(int32 PreviousAmmo);

    UFUNCTION(BlueprintImplementableEvent, Category="TGG|Combat")
    void BP_OnAmmoChanged(int32 PreviousAmmo, int32 NewAmmo);

    bool CanFireServer() const;
    bool ConsumeAmmoServer();

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
