output "control_instance_id" {
  value = oci_core_instance.control.id
}

output "control_public_ip" {
  value = oci_core_instance.control.public_ip
}

output "control_private_ip" {
  value = oci_core_instance.control.private_ip
}

output "coolify_setup_url" {
  value = "http://${oci_core_instance.control.public_ip}:8000"
}

output "game_node_enabled" {
  value = var.enable_game_node
}

output "game_public_ip" {
  value = var.enable_game_node ? oci_core_instance.game[0].public_ip : null
}

output "game_private_ip" {
  value = var.enable_game_node ? oci_core_instance.game[0].private_ip : null
}

output "game_connect_hint" {
  value = var.enable_game_node ? "${oci_core_instance.game[0].public_ip}:${var.game_udp_port}" : null
}

output "cost_warning" {
  value = var.enable_game_node ? "x86 Unreal node enabled: verify OCI pricing before Apply." : "x86 Unreal node disabled."
}

output "tgg_candidate_sha" {
  value = lower(var.candidate_sha)
}

output "tgg_control_plane_commit" {
  value = lower(var.control_plane_commit)
}

output "host_agent_local_url" {
  value = "http://127.0.0.1:8787"
}

output "host_agent_bootstrap_status" {
  value = "HOST_AGENT_LOCAL_READY_TOKEN_REQUIRED"
}

output "next_step" {
  value = "Host Agent is installed locally. Inject TGG_REMOTE_TOKEN securely, configure HTTPS reverse proxy, then run npm run check:tgg-live-readiness."
}


output "video_ai_release_sha" {
  value = lower(var.video_ai_release_sha)
}

output "video_ai_release_branch" {
  value = var.video_ai_release_branch
}

output "video_ai_checkout_status" {
  value = "VIDEO_AI_RELEASE_PINNED_NOT_DEPLOYED"
}
