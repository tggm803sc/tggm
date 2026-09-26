data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

locals {
  ad_name = data.oci_identity_availability_domains.ads.availability_domains[var.availability_domain_index].name
}

data "oci_core_images" "ubuntu_arm" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

data "oci_core_images" "ubuntu_x86" {
  count                    = var.enable_game_node ? 1 : 0
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = var.game_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_vcn" "tgg" {
  compartment_id = var.compartment_ocid
  cidr_block     = var.vcn_cidr
  display_name   = "tgg-production-vcn"
  dns_label      = "tggprod"
}

resource "oci_core_internet_gateway" "tgg" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.tgg.id
  display_name   = "tgg-production-igw"
  enabled        = true
}

resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.tgg.id
  display_name   = "tgg-public-routes"
  route_rules {
    network_entity_id = oci_core_internet_gateway.tgg.id
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
  }
}

resource "oci_core_security_list" "control" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.tgg.id
  display_name   = "tgg-control-security"

  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 80
      max = 80
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 443
      max = 443
    }
  }

  dynamic "ingress_security_rules" {
    for_each = toset([22, 8000, 6001, 6002])
    content {
      protocol = "6"
      source   = var.admin_cidr
      tcp_options {
        min = ingress_security_rules.value
        max = ingress_security_rules.value
      }
    }
  }
}

resource "oci_core_security_list" "runtime" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.tgg.id
  display_name   = "tgg-runtime-security"

  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }

  ingress_security_rules {
    protocol = "17"
    source   = "0.0.0.0/0"
    udp_options {
      min = var.game_udp_port
      max = var.game_udp_port
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = var.admin_cidr
    tcp_options {
      min = 22
      max = 22
    }
  }

}

resource "oci_core_subnet" "control" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.tgg.id
  cidr_block                 = var.control_subnet_cidr
  display_name               = "tgg-control-public"
  route_table_id             = oci_core_route_table.public.id
  security_list_ids          = [oci_core_security_list.control.id]
  prohibit_public_ip_on_vnic = false
  dns_label                  = "control"
}

resource "oci_core_subnet" "runtime" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.tgg.id
  cidr_block                 = var.runtime_subnet_cidr
  display_name               = "tgg-runtime-public"
  route_table_id             = oci_core_route_table.public.id
  security_list_ids          = [oci_core_security_list.runtime.id]
  prohibit_public_ip_on_vnic = false
  dns_label                  = "runtime"
}

resource "oci_core_instance" "control" {
  availability_domain = local.ad_name
  compartment_id      = var.compartment_ocid
  display_name        = "tgg-production-control"
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = var.control_ocpus
    memory_in_gbs = var.control_memory_gbs
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.control.id
    assign_public_ip = true
    hostname_label   = "control"
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_arm.images[0].id
    boot_volume_size_in_gbs = var.control_boot_volume_gbs
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init-control.yaml.tftpl", {
      candidate_sha        = lower(var.candidate_sha)
      control_plane_repo   = var.control_plane_repo_url
      control_plane_commit = lower(var.control_plane_commit)
    }))
  }

  freeform_tags = {
    "tgg-role" = "online-control-host"
    "tgg-sha"  = lower(var.candidate_sha)
  }
}

resource "oci_core_instance" "game" {
  count               = var.enable_game_node ? 1 : 0
  availability_domain = local.ad_name
  compartment_id      = var.compartment_ocid
  display_name        = "tgg-unreal-runtime"
  shape               = var.game_shape

  shape_config {
    ocpus         = var.game_ocpus
    memory_in_gbs = var.game_memory_gbs
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.runtime.id
    assign_public_ip = true
    hostname_label   = "runtime"
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_x86[0].images[0].id
    boot_volume_size_in_gbs = var.game_boot_volume_gbs
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init-game.yaml.tftpl", {
      candidate_sha = lower(var.candidate_sha)
      game_udp_port = var.game_udp_port
    }))
  }

  freeform_tags = {
    "tgg-role" = "unreal-dedicated-runtime"
    "tgg-sha"  = lower(var.candidate_sha)
  }
}
