variable "tenancy_ocid" {
  type = string
}

variable "compartment_ocid" {
  type = string
}

variable "region" {
  type = string
}

variable "availability_domain_index" {
  type    = number
  default = 0
  validation {
    condition     = var.availability_domain_index >= 0 && floor(var.availability_domain_index) == var.availability_domain_index
    error_message = "availability_domain_index must be a non-negative integer."
  }
}

variable "admin_cidr" {
  type        = string
  description = "Required administrator CIDR. Use your public IP as /32 whenever possible."
  validation {
    condition     = can(cidrhost(var.admin_cidr, 0)) && var.admin_cidr != "0.0.0.0/0" && var.admin_cidr != "::/0"
    error_message = "admin_cidr must be a valid non-global CIDR; 0.0.0.0/0 and ::/0 are not allowed."
  }
}

variable "ssh_public_key" {
  type    = string
  default = ""
}

variable "control_plane_repo_url" {
  type    = string
  default = "https://github.com/tggm803sc/tggm.git"
}

variable "control_plane_commit" {
  type    = string
  default = "7c971ec44be0daf00d81807f588db264239f5fe4"
  validation {
    condition     = can(regex("^[0-9a-fA-F]{40}$", var.control_plane_commit))
    error_message = "control_plane_commit must be exactly 40 hexadecimal characters."
  }
}

variable "candidate_sha" {
  type    = string
  default = "b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"
  validation {
    condition     = can(regex("^[0-9a-fA-F]{64}$", var.candidate_sha))
    error_message = "candidate_sha must be exactly 64 hexadecimal characters."
  }
}

variable "vcn_cidr" {
  type    = string
  default = "10.90.0.0/16"
}

variable "control_subnet_cidr" {
  type    = string
  default = "10.90.10.0/24"
}

variable "runtime_subnet_cidr" {
  type    = string
  default = "10.90.20.0/24"
}

variable "control_ocpus" {
  type    = number
  default = 2
}

variable "control_memory_gbs" {
  type    = number
  default = 12
}

variable "control_boot_volume_gbs" {
  type    = number
  default = 50
}

variable "enable_game_node" {
  type    = bool
  default = false
}

variable "allow_paid_game_node" {
  type    = bool
  default = false
  validation {
    condition     = !var.enable_game_node || var.allow_paid_game_node
    error_message = "enable_game_node requires allow_paid_game_node=true."
  }
}

variable "game_shape" {
  type    = string
  default = "VM.Standard.E4.Flex"
}

variable "game_ocpus" {
  type    = number
  default = 4
}

variable "game_memory_gbs" {
  type    = number
  default = 24
}

variable "game_boot_volume_gbs" {
  type    = number
  default = 100
}

variable "game_udp_port" {
  type    = number
  default = 7777
  validation {
    condition     = var.game_udp_port >= 1 && var.game_udp_port <= 65535 && floor(var.game_udp_port) == var.game_udp_port
    error_message = "game_udp_port must be an integer from 1 through 65535."
  }
}


variable "video_ai_release_sha" {
  type    = string
  default = "469518eff0fe1641f6889c5ff78c2f3c0df189c7"
  validation {
    condition     = can(regex("^[0-9a-fA-F]{40}$", var.video_ai_release_sha))
    error_message = "video_ai_release_sha must be exactly 40 hexadecimal characters."
  }
}

variable "video_ai_release_branch" {
  type    = string
  default = "release/tgg-video-ai-v1"
}
