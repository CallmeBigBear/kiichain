FROM ubuntu:latest
ENV HOME="/root" PATH="/root/go/bin:$PATH"
RUN apt-get update && \
    apt-get install -y make git build-essential jq python3 curl vim uuid-runtime
RUN curl -L https://go.dev/dl/go1.21.4.linux-amd64.tar.gz | tar xvzf - -C /usr/local/
RUN mkdir -p /root/go/pkg/mod && \
    mkdir -p /root/.cache && \
    chmod -R a+rwX /root
RUN /usr/local/go/bin/go install cosmossdk.io/tools/cosmovisor/cmd/cosmovisor@v1.5.0
SHELL ["/bin/bash", "-c"]
WORKDIR /kiichain/kiichain3

EXPOSE 26656 26657 26658 9090 9091

COPY scripts/deploy.sh /usr/bin/deploy.sh
COPY scripts/step0_build.sh /usr/bin/build.sh
COPY scripts/step1_configure_init.sh /usr/bin/configure_init.sh
COPY scripts/step2_start_kiichain.sh /usr/bin/start_kiichain.sh

CMD ["/usr/bin/deploy.sh"]

STOPSIGNAL SIGTERM
