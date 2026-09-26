#include "AudioMiddlewareComponent.h"

#include "Net/UnrealNetwork.h"

UAudioMiddlewareComponent::UAudioMiddlewareComponent()
{
    SetIsReplicatedByDefault(true);
    PrimaryComponentTick.bCanEverTick = false;
}

void UAudioMiddlewareComponent::SetAcousticState(const FAcousticZoneState& NewState)
{
    AActor* Owner = GetOwner();
    if (!Owner || !Owner->HasAuthority())
    {
        return;
    }

    State = NewState;
    State.ReverbSend = FMath::Clamp(State.ReverbSend, 0.0f, 1.0f);
    State.Occlusion = FMath::Clamp(State.Occlusion, 0.0f, 1.0f);
    BP_ApplyAcousticState(State);
}

void UAudioMiddlewareComponent::OnRep_State()
{
    BP_ApplyAcousticState(State);
}

void UAudioMiddlewareComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(UAudioMiddlewareComponent, State);
}
