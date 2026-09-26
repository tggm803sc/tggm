#include "EnemyAIController.h"

AEnemyAIController::AEnemyAIController()
{
    bAttachToPawn = true;
}

void AEnemyAIController::SetCombatTarget(AActor* NewTarget)
{
    if (!HasAuthority())
    {
        return;
    }

    CombatTarget = NewTarget;

    if (IsValid(NewTarget))
    {
        MoveToActor(NewTarget, AcceptanceRadius, true, true, true, nullptr, true);
    }
    else
    {
        StopMovement();
    }
}
