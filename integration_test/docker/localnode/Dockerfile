FROM ubuntu:latest
ENV HOME="/root" PATH="/root/go/bin:/kiichain/kiichain3/integration_test/upgrade_module/scripts/:/kiichain/kiichain3/integration_test/upgrade/scripts/:$PATH"
RUN apt-get update && apt-get install -y make build-essential git jq python3 curl vim uuid-runtime
RUN curl -L https://go.dev/dl/go1.22.4.linux-amd64.tar.gz | tar xvzf - -C /usr/local/
RUN curl -L https://foundry.paradigm.xyz | bash
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash
RUN /root/.foundry/bin/foundryup
RUN mkdir -p /root/go/pkg/mod && \
    mkdir -p /root/.cache && \
    chmod -R a+rwX /root
SHELL ["/bin/bash", "-c"]

WORKDIR /kiichain/kiichain3

EXPOSE 26656 26657 26658 9090 9091 7171

CMD ["/usr/bin/deploy.sh"]

STOPSIGNAL SIGTERM

COPY scripts/deploy.sh /usr/bin/deploy.sh
COPY scripts/step0_build.sh /usr/bin/build.sh
COPY scripts/step1_configure_init.sh /usr/bin/configure_init.sh
COPY scripts/step2_genesis.sh /usr/bin/genesis.sh
COPY scripts/step3_add_validator_to_genesis.sh /usr/bin/add_validator_to_gensis.sh
COPY scripts/step4_config_override.sh /usr/bin/config_override.sh
COPY scripts/step5_start_kii.sh /usr/bin/start_kii.sh
# COPY scripts/step6_start_price_feeder.sh /usr/bin/start_price_feeder.sh # TODO: Re-enable me after we have the oracle module again
