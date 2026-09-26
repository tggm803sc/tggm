#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "PlayerCharacter.generated.h"

UCLASS()
class MULTIPLAYERFRAMEWORK_API APlayerCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    APlayerCharacter();

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    UFUNCTION(BlueprintCallable, Category="TGG|Player")
    void ApplyServerDamage(float Amount);

    UFUNCTION(BlueprintPure, Category="TGG|Player")
    float GetHealth() const { return Health; }

    UFUNCTION(BlueprintPure, Category="TGG|Player")
    bool IsAlive() const { return Health > 0.0f; }

protected:
    virtual void BeginPlay() override;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="TGG|Player", meta=(ClampMin="1.0"))
    float MaxHealth = 100.0f;

    UPROPERTY(ReplicatedUsing=OnRep_Health, VisibleInstanceOnly, BlueprintReadOnly, Category="TGG|Player")
    float Health = 100.0f;

    UFUNCTION()
    void OnRep_Health(float PreviousHealth);

    UFUNCTION(BlueprintImplementableEvent, Category="TGG|Player")
    void BP_OnHealthChanged(float PreviousHealth, float NewHealth);
};
