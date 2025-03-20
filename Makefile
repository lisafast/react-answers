.PHONY: fmt checkov install lint test fmt-ci lint-ci build install-dev

terraform-fmt:
	terraform fmt -recursive terragrunt/aws &&\
	terragrunt hclfmt

checkov:
	checkov --directory=aws

run-dev:
	npm run dev

install:
	npm install

lint: 
	npm run lint

fmt:
	npm run format

test: ;
